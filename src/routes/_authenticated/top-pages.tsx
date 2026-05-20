import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/top-pages")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["tp", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("top_pages").select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error; return data ?? [];
    },
  });
  const rows = data ?? [];
  const map = new Map<string, any>();
  for (const r of rows) {
    const e = map.get(r.page_path) ?? { page_path: r.page_path, pageviews: 0, sessions: 0, users: 0, engagedSessions: 0, engDuration: 0 };
    const s = r.sessions ?? 0;
    e.pageviews += r.pageviews ?? 0; e.sessions += s;
    e.users += r.total_users ?? 0;
    // engagement_rate stored as % (0..100). Reconstruct engaged sessions for weighted aggregation.
    e.engagedSessions += s * (Number(r.engagement_rate ?? 0) / 100);
    e.engDuration += Number(r.avg_engagement_time ?? 0) * s;
    map.set(r.page_path, e);
  }
  const agg = [...map.values()].map(e => ({
    ...e,
    eng: e.sessions > 0 ? e.engDuration / e.sessions : 0,
    bounce: e.sessions > 0 ? (1 - e.engagedSessions / e.sessions) * 100 : 0,
  })).sort((a, b) => b.pageviews - a.pageviews).slice(0, 50);


  return (
    <div className="space-y-6">
      <ModuleHeader title="Top Pages" />
      {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : agg.length === 0 ? (
        <EmptyState icon={Plug} title="No page data" description="Connect GA4 to view top pages." actionLabel="Connect GA4" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Page</TableHead><TableHead className="text-right">Views</TableHead><TableHead className="text-right">Sessions</TableHead><TableHead className="text-right">Users</TableHead><TableHead className="text-right">Avg Eng. Time</TableHead><TableHead className="text-right">Bounce Rate</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {agg.map(r => (
                <TableRow key={r.page_path}>
                  <TableCell className="font-mono text-xs max-w-md truncate">{r.page_path}</TableCell>
                  <TableCell className="text-right">{r.pageviews.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.sessions.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.users.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{(r.eng).toFixed(1)}s</TableCell>
                  <TableCell className="text-right">{(r.bounce).toFixed(1)}%</TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
