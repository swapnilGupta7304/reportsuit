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
  // Aggregate per pagePath across the selected date range.
  // - Counters (pageviews/users/sessions): summed across days.
  // - Bounce rate: session-weighted (matches GA4 UI).
  // - Views per active user: pageviews / activeUsers (matches GA4 screenPageViewsPerUser).
  const map = new Map<string, any>();
  for (const r of rows) {
    const e = map.get(r.page_path) ?? {
      page_path: r.page_path,
      pageviews: 0, totalUsers: 0, activeUsers: 0, newUsers: 0,
      sessions: 0, bounceWeighted: 0,
    };
    const s = Number(r.sessions ?? 0);
    e.pageviews += Number(r.pageviews ?? 0);
    e.totalUsers += Number(r.total_users ?? 0);
    e.activeUsers += Number(r.active_users ?? 0);
    e.newUsers += Number(r.new_users ?? 0);
    e.sessions += s;
    e.bounceWeighted += Number(r.bounce_rate ?? 0) * s; // stored as 0..100
    map.set(r.page_path, e);
  }
  const agg = [...map.values()].map(e => ({
    page_path: e.page_path,
    totalUsers: e.totalUsers,
    activeUsers: e.activeUsers,
    newUsers: e.newUsers,
    returningUsers: Math.max(0, e.totalUsers - e.newUsers),
    viewsPerActiveUser: e.activeUsers > 0 ? e.pageviews / e.activeUsers : 0,
    bounceRate: e.sessions > 0 ? e.bounceWeighted / e.sessions : 0,
    _sort: e.pageviews,
  })).sort((a, b) => b._sort - a._sort).slice(0, 50);

  return (
    <div className="space-y-6">
      <ModuleHeader title="Top Pages" subtitle="GA4 Pages and screens — exact metric parity" />
      {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : agg.length === 0 ? (
        <EmptyState icon={Plug} title="No page data" description="Connect GA4 to view top pages." actionLabel="Connect GA4" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page path</TableHead>
                <TableHead className="text-right">Total Users</TableHead>
                <TableHead className="text-right">Active Users</TableHead>
                <TableHead className="text-right">New Users</TableHead>
                <TableHead className="text-right">Returning Users</TableHead>
                <TableHead className="text-right">Views / Active User</TableHead>
                <TableHead className="text-right">Bounce Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agg.map(r => (
                <TableRow key={r.page_path}>
                  <TableCell className="font-mono text-xs max-w-md truncate">{r.page_path}</TableCell>
                  <TableCell className="text-right">{r.totalUsers.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.activeUsers.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.newUsers.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.returningUsers.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.viewsPerActiveUser.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{r.bounceRate.toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
