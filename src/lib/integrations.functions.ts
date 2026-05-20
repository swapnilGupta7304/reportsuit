import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ga4ListProperties, ga4GetPropertyMeta } from "./ga4.server";
import { syncProjectGA4 } from "./ga4-sync.server";
import { syncProjectPlayConsole, getServiceAccountEmail } from "./play-console.server";

async function assertOrgMember(orgId: string, userId: string) {
  const { data } = await supabaseAdmin.from("organization_members").select("role")
    .eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Not a member of this organization");
  return data.role as string;
}

async function assertProjectAccess(projectId: string, userId: string) {
  const { data: project } = await supabaseAdmin.from("projects").select("organization_id").eq("id", projectId).single();
  if (!project) throw new Error("Project not found");
  await assertOrgMember(project.organization_id, userId);
  return project.organization_id;
}

// ============ GA4 ============

export const listGa4Properties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ integrationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: integ } = await supabaseAdmin.from("integrations")
      .select("organization_id").eq("id", data.integrationId).single();
    if (!integ) throw new Error("Integration not found");
    await assertOrgMember(integ.organization_id, context.userId);
    return await ga4ListProperties(data.integrationId);
  });

export const linkGa4Property = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    integrationId: z.string().uuid(),
    projectId: z.string().uuid(),
    propertyId: z.string().min(1),
    propertyName: z.string().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertProjectAccess(data.projectId, context.userId);

    let meta: { timeZone: string; currencyCode: string } | null = null;
    try { meta = await ga4GetPropertyMeta(data.integrationId, data.propertyId); }
    catch { /* non-fatal */ }

    await supabaseAdmin.from("ga4_properties").delete().eq("project_id", data.projectId);
    const { error } = await supabaseAdmin.from("ga4_properties").insert({
      project_id: data.projectId, integration_id: data.integrationId,
      property_id: data.propertyId, property_name: data.propertyName ?? null,
      timezone: meta?.timeZone ?? null,
      currency_code: meta?.currencyCode ?? null,
    });
    if (error) throw error;
    return { ok: true, timezone: meta?.timeZone, currency: meta?.currencyCode };
  });

export const syncProjectNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertProjectAccess(data.projectId, context.userId);
    return await syncProjectGA4(data.projectId);
  });

export const getGa4PropertyForProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertProjectAccess(data.projectId, context.userId);
    const { data: prop } = await supabaseAdmin.from("ga4_properties").select("*")
      .eq("project_id", data.projectId).maybeSingle();
    return prop;
  });

// ============ Play Console ============

export const getPlayConsoleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertProjectAccess(data.projectId, context.userId);
    const [{ data: app }, serviceAccountEmail] = await Promise.all([
      supabaseAdmin.from("play_console_apps").select("*").eq("project_id", data.projectId).maybeSingle(),
      getServiceAccountEmail(),
    ]);
    return { app, serviceAccountEmail };
  });

export const linkPlayConsoleApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    projectId: z.string().uuid(),
    packageName: z.string().min(3).max(255).regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/, "Invalid Android package name"),
    appName: z.string().max(255).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const orgId = await assertProjectAccess(data.projectId, context.userId);

    // Ensure an org-level integration row exists for play_console
    let { data: integ } = await supabaseAdmin.from("integrations").select("*")
      .eq("organization_id", orgId).eq("provider", "play_console" as any).maybeSingle();
    const saEmail = await getServiceAccountEmail();
    if (!integ) {
      const { data: ins, error } = await supabaseAdmin.from("integrations").insert({
        organization_id: orgId, provider: "play_console" as any,
        status: "connected" as any, account_label: saEmail,
        created_by: context.userId, metadata: { service_account_email: saEmail } as any,
      }).select().single();
      if (error) throw error;
      integ = ins;
    } else {
      await supabaseAdmin.from("integrations").update({
        status: "connected" as any, account_label: saEmail,
        metadata: { ...((integ.metadata ?? {}) as object), service_account_email: saEmail } as any,
      }).eq("id", integ.id);
    }

    await supabaseAdmin.from("play_console_apps").delete().eq("project_id", data.projectId);
    const { error } = await supabaseAdmin.from("play_console_apps").insert({
      project_id: data.projectId, integration_id: integ!.id,
      package_name: data.packageName, app_name: data.appName ?? null,
      developer_account: saEmail,
    });
    if (error) throw error;
    return { ok: true };
  });

export const syncPlayConsoleNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertProjectAccess(data.projectId, context.userId);
    return await syncProjectPlayConsole(data.projectId);
  });
