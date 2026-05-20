import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncProjectPlayConsole } from "@/lib/play-console.server";

export const Route = createFileRoute("/api/public/hooks/sync-daily-play")({
  server: {
    handlers: {
      POST: async () => {
        const { data: apps } = await supabaseAdmin.from("play_console_apps").select("project_id");
        const results: any[] = [];
        for (const row of apps ?? []) {
          try {
            const r = await syncProjectPlayConsole(row.project_id);
            results.push({ project_id: row.project_id, ok: true, days: r.days });
          } catch (e: any) {
            results.push({ project_id: row.project_id, ok: false, error: e?.message });
          }
        }
        return Response.json({ synced: results.length, results });
      },
    },
  },
});
