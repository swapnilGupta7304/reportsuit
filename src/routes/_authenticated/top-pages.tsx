import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plug, FileText, Users, Eye } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard, GradientKpi } from "@/components/ChartCard";
import { PALETTE, PALETTE_LIST, TOOLTIP_STYLE } from "@/lib/chart-palette";

export const Route = createFileRoute("/_authenticated/top-pages")({
  component: () => (
    <NoProjectGate>
      <Inner />
    </NoProjectGate>
  ),
});

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["tp", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_pages")
        .select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = data ?? [];

  // Aggregate per pagePath. Build per-page sparkline trend (by date).
  const map = new Map<string, any>();
  const trendMap = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const e = map.get(r.page_path) ?? {
      page_path: r.page_path,
      pageviews: 0,
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      sessions: 0,
      bounceWeighted: 0,
    };
    const s = Number(r.sessions ?? 0);
    e.pageviews += Number(r.pageviews ?? 0);
    e.totalUsers += Number(r.total_users ?? 0);
    e.activeUsers += Number(r.active_users ?? 0);
    e.newUsers += Number(r.new_users ?? 0);
    e.sessions += s;
    e.bounceWeighted += Number(r.bounce_rate ?? 0) * s;
    map.set(r.page_path, e);

    const t = trendMap.get(r.page_path) ?? new Map<string, number>();
    t.set(r.metric_date, (t.get(r.metric_date) ?? 0) + Number(r.pageviews ?? 0));
    trendMap.set(r.page_path, t);
  }

  const agg = [...map.values()]
    .map((e) => ({
      page_path: e.page_path,
      pageviews: e.pageviews,
      totalUsers: e.totalUsers,
      activeUsers: e.activeUsers,
      newUsers: e.newUsers,
      returningUsers: Math.max(0, e.totalUsers - e.newUsers),
      viewsPerActiveUser: e.activeUsers > 0 ? e.pageviews / e.activeUsers : 0,
      bounceRate: e.sessions > 0 ? e.bounceWeighted / e.sessions : 0,
      trend: [...(trendMap.get(e.page_path) ?? new Map()).entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, v })),
    }))
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, 50);

  const totals = agg.reduce(
    (a, e) => ({
      pageviews: a.pageviews + e.pageviews,
      totalUsers: a.totalUsers + e.totalUsers,
      activeUsers: a.activeUsers + e.activeUsers,
      newUsers: a.newUsers + e.newUsers,
    }),
    { pageviews: 0, totalUsers: 0, activeUsers: 0, newUsers: 0 },
  );

  const top10 = agg.slice(0, 10).map((r) => ({
    ...r,
    short: r.page_path.length > 28 ? "…" + r.page_path.slice(-26) : r.page_path,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader title="Top Pages" subtitle="GA4 Pages and screens — exact metric parity" />
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : agg.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No page data"
          description="Connect GA4 to view top pages."
          actionLabel="Connect GA4"
          onAction={() => nav({ to: "/settings" })}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GradientKpi label="Pageviews" value={totals.pageviews.toLocaleString()} from={PALETTE.orange} to={PALETTE.pink} delay={0} />
            <GradientKpi label="Unique Pages" value={agg.length} from={PALETTE.blue} to={PALETTE.cyan} delay={0.05} />
            <GradientKpi label="Total Users" value={totals.totalUsers.toLocaleString()} from={PALETTE.purple} to={PALETTE.pink} delay={0.1} />
            <GradientKpi label="New Users" value={totals.newUsers.toLocaleString()} from={PALETTE.green} to={PALETTE.teal} delay={0.15} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <ChartCard title="Top 10 pages — pageviews" subtitle="Gradient ranking" delay={0.1}>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <defs>
                    {top10.map((_, i) => (
                      <linearGradient key={i} id={`tp-bar-${i}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={PALETTE_LIST[i % PALETTE_LIST.length]} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={PALETTE_LIST[(i + 3) % PALETTE_LIST.length]} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="short" type="category" width={160} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.25 }} />
                  <Bar dataKey="pageviews" radius={[0, 8, 8, 0]} animationDuration={900}>
                    {top10.map((_, i) => (
                      <Cell key={i} fill={`url(#tp-bar-${i})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Users comparison" subtitle="New vs Returning per top page" delay={0.15}>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="short" type="category" width={160} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="newUsers" name="New" stackId="u" fill={PALETTE.purple} />
                  <Bar dataKey="returningUsers" name="Returning" stackId="u" fill={PALETTE.green} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-2xl border bg-card shadow-card overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page path</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead className="text-right">Total Users</TableHead>
                  <TableHead className="text-right">Active Users</TableHead>
                  <TableHead className="text-right">New Users</TableHead>
                  <TableHead className="text-right">Returning Users</TableHead>
                  <TableHead className="text-right">Views / Active User</TableHead>
                  <TableHead className="text-right">Bounce Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agg.map((r, i) => (
                  <TableRow key={r.page_path} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs max-w-md truncate">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ background: PALETTE_LIST[i % PALETTE_LIST.length] }}
                        />
                        {r.page_path}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="h-8 w-24">
                        {r.trend.length > 1 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={r.trend}>
                              <Line
                                type="monotone"
                                dataKey="v"
                                stroke={PALETTE_LIST[i % PALETTE_LIST.length]}
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
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
          </motion.div>
        </>
      )}
    </div>
  );
}

void FileText;
void Users;
void Eye;
