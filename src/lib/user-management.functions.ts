import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string, orgId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") throw new Error("Forbidden: admin role required");
}

export const listOrgUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // any member can list
    const { data: members, error } = await supabase
      .from("organization_members")
      .select("id, user_id, role, created_at")
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    if (!members?.length) return { members: [], me: userId };

    const ids = members.map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ids);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const enriched = await Promise.all(
      members.map(async (m: any) => {
        const p = profiles?.find((x: any) => x.id === m.user_id);
        let last_sign_in_at: string | null = null;
        let disabled = false;
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
          last_sign_in_at = (u?.user as any)?.last_sign_in_at ?? null;
          const banned = (u?.user as any)?.banned_until;
          disabled = !!(banned && new Date(banned).getTime() > Date.now());
        } catch {}
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: p?.email ?? null,
          display_name: p?.display_name ?? null,
          last_sign_in_at,
          disabled,
        };
      }),
    );
    return { members: enriched, me: userId };
  });

export const createOrgUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    orgId: string;
    email: string;
    password: string;
    displayName: string;
    role: "admin" | "editor" | "viewer";
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check existing
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();

    let newUserId: string;
    if (existing) {
      newUserId = existing.id;
      // update password and metadata
      await supabaseAdmin.auth.admin.updateUserById(newUserId, {
        password: data.password,
        user_metadata: { full_name: data.displayName },
      });
      await supabaseAdmin
        .from("profiles")
        .update({ display_name: data.displayName })
        .eq("id", newUserId);
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.displayName },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
      newUserId = created.user.id;
      // handle_new_user trigger creates profile + a personal org; ensure display_name set
      await supabaseAdmin
        .from("profiles")
        .upsert({ id: newUserId, email: data.email, display_name: data.displayName });
    }

    // Upsert membership in THIS org
    const { error: memErr } = await supabaseAdmin
      .from("organization_members")
      .upsert(
        { organization_id: data.orgId, user_id: newUserId, role: data.role },
        { onConflict: "organization_id,user_id" },
      );
    if (memErr) throw new Error(memErr.message);
    return { ok: true, user_id: newUserId };
  });

export const updateOrgUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    orgId: string;
    userId: string;
    displayName?: string;
    email?: string;
    role?: "admin" | "editor" | "viewer";
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.email || data.displayName) {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ...(data.email ? { email: data.email } : {}),
        ...(data.displayName ? { user_metadata: { full_name: data.displayName } } : {}),
      });
      await supabaseAdmin
        .from("profiles")
        .update({
          ...(data.email ? { email: data.email } : {}),
          ...(data.displayName ? { display_name: data.displayName } : {}),
        })
        .eq("id", data.userId);
    }
    if (data.role) {
      await supabaseAdmin
        .from("organization_members")
        .update({ role: data.role })
        .eq("organization_id", data.orgId)
        .eq("user_id", data.userId);
    }
    return { ok: true };
  });

export const changeOrgUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; userId: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setOrgUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; userId: string; disabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrgUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.orgId);
    if (context.userId === data.userId) throw new Error("You cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove only from this org; do not delete auth user (may belong to other orgs)
    const { error } = await supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
