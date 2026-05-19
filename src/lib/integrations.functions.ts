import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ga4ListProperties } from "./ga4.server";
import { syncProjectGA4 } from "./ga4-sync.server";

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
    await supabaseAdmin.from("ga4_properties").delete().eq("project_id", data.projectId);
    const { error } = await supabaseAdmin.from("ga4_properties").insert({
      project_id: data.projectId, integration_id: data.integrationId,
      property_id: data.propertyId, property_name: data.propertyName ?? null,
    });
    if (error) throw error;
    return { ok: true };
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
