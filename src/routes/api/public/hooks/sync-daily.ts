import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncProjectGA4 } from "@/lib/ga4-sync.server";

export const Route = createFileRoute("/api/public/hooks/sync-daily")({
  server: {
    handlers: {
      POST: async () => {
        const { data: props } = await supabaseAdmin.from("ga4_properties").select("project_id");
        const results: any[] = [];
        for (const row of props ?? []) {
          try {
            const r = await syncProjectGA4(row.project_id);
            results.push({ project_id: row.project_id, ok: true, totals: r.totals });
          } catch (e: any) {
            results.push({ project_id: row.project_id, ok: false, error: e?.message });
          }
        }
        return Response.json({ synced: results.length, results });
      },
    },
  },
});
