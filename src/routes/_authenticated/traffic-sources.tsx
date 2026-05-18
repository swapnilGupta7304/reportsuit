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

export const Route = createFileRoute("/_authenticated/traffic-sources")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

const GA4_CHANNELS = ["Organic Search", "Direct", "Referral", "Organic Social", "Email", "Paid Search", "Organic Video", "Unassigned"];

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["ts", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("traffic_sources").select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error; return data ?? [];
    },
  });
  const rows = data ?? [];
  // Aggregate by source
  const map = new Map<string, { sessions: number; engaged: number; engRate: number; avgEng: number; bounce: number; eps: number; ev: number; n: number }>();
  for (const r of rows) {
    const k = r.source ?? "Unassigned";
    const e = map.get(k) ?? { sessions: 0, engaged: 0, engRate: 0, avgEng: 0, bounce: 0, eps: 0, ev: 0, n: 0 };
    e.sessions += r.sessions ?? 0; e.engaged += r.engaged_sessions ?? 0;
    e.engRate += Number(r.engagement_rate ?? 0); e.avgEng += Number(r.avg_engagement_time_per_session ?? 0);
    e.bounce += Number(r.bounce_rate ?? 0); e.eps += Number(r.events_per_session ?? 0);
    e.ev += r.event_count ?? 0; e.n += 1;
    map.set(k, e);
  }
  // Show all GA4 channels, with zero for missing
  const agg = GA4_CHANNELS.map(name => {
    const e = map.get(name);
    if (!e) return { name, sessions: 0, engaged: 0, engRate: 0, avgEng: 0, bounce: 0, eps: 0, ev: 0 };
    return { name, sessions: e.sessions, engaged: e.engaged, engRate: e.n ? e.engRate / e.n : 0, avgEng: e.n ? e.avgEng / e.n : 0, bounce: e.n ? e.bounce / e.n : 0, eps: e.n ? e.eps / e.n : 0, ev: e.ev };
  });
  const hasData = rows.length > 0;

  return (
    <div className="space-y-6">
      <ModuleHeader title="Traffic Sources" subtitle="GA4 default channel grouping" />
      {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : !hasData ? (
        <EmptyState icon={Plug} title="No traffic source data" description="Connect GA4 to ingest channel-level metrics." actionLabel="Connect GA4" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Engaged Sessions</TableHead>
                <TableHead className="text-right">Engagement Rate</TableHead>
                <TableHead className="text-right">Avg Eng. Time / Session</TableHead>
                <TableHead className="text-right">Bounce Rate</TableHead>
                <TableHead className="text-right">Events / Session</TableHead>
                <TableHead className="text-right">Event Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agg.map(r => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{r.sessions.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.engaged.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.engRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{r.avgEng.toFixed(1)}s</TableCell>
                  <TableCell className="text-right">{r.bounce.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{r.eps.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{r.ev.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
