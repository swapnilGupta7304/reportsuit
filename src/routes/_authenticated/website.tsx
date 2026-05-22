import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Users, Activity, UserPlus, Repeat, TrendingUp, MousePointer, Clock, Plug } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { KpiCard } from "@/components/KpiCard";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ga4Aggregate } from "@/lib/ga4-live.functions";
import { readTotal } from "@/lib/ga4-live";

export const Route = createFileRoute("/_authenticated/website")({ component: Page });

function Page() {
  return <NoProjectGate><Inner /></NoProjectGate>;
}
function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const startDate = format(range.from, "yyyy-MM-dd");
  const endDate = format(range.to, "yyyy-MM-dd");

  const aggFn = useServerFn(ga4Aggregate);
  const { data: live, isLoading: liveLoading } = useQuery({
    queryKey: ["wm_live", currentProject!.id, startDate, endDate],
    queryFn: () =>
      aggFn({
        data: {
          projectId: currentProject!.id,
          dimensions: [],
          metrics: [
            "totalUsers", "activeUsers", "newUsers",
            "sessions", "engagedSessions", "engagementRate",
            "bounceRate", "userEngagementDuration", "averageSessionDuration",
            "eventCount",
          ],
          startDate, endDate,
        },
      }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["wm", currentProject!.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.from("website_metrics").select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", startDate)
        .lte("metric_date", endDate)
        .order("metric_date");
      if (error) throw error; return data ?? [];
    },
  });
  const rows = data ?? [];

  // EXACT GA4 totals (live, no per-day summing)
  const totalUsers = live ? readTotal(live, "totalUsers") : 0;
  const activeUsers = live ? readTotal(live, "activeUsers") : 0;
  const newUsers = live ? readTotal(live, "newUsers") : 0;
  const returningUsers = Math.max(0, totalUsers - newUsers);
  const sessions = live ? readTotal(live, "sessions") : 0;
  const engagedSessions = live ? readTotal(live, "engagedSessions") : 0;
  const eventCount = live ? readTotal(live, "eventCount") : 0;
  const engagementRate = sessions > 0 ? (engagedSessions / sessions) * 100 : 0;
  const bounceRate = 100 - engagementRate;
  const avgEngTime = live && sessions > 0 ? readTotal(live, "userEngagementDuration") / sessions : 0;

  const loading = isLoading || liveLoading;

  return (
    <div className="space-y-8">
      <ModuleHeader title="Website Analytics" subtitle="GA4 web property — exact API values" />
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : !live || sessions === 0 && totalUsers === 0 ? (
        <EmptyState icon={Plug} title="No website data synced yet" description="Connect Google Analytics 4 in Settings to populate this module." actionLabel="Go to Settings" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Users" value={totalUsers.toLocaleString()} icon={Users} />
            <KpiCard label="Active Users" value={activeUsers.toLocaleString()} icon={Activity} />
            <KpiCard label="New Users" value={newUsers.toLocaleString()} icon={UserPlus} />
            <KpiCard label="Returning" value={returningUsers.toLocaleString()} icon={Repeat} />
            <KpiCard label="Sessions" value={sessions.toLocaleString()} icon={TrendingUp} />
            <KpiCard label="Events" value={eventCount.toLocaleString()} icon={MousePointer} />
            <KpiCard label="Avg Engagement" value={`${engagementRate.toFixed(1)}%`} hint={`${avgEngTime.toFixed(1)}s`} icon={Clock} />
            <KpiCard label="Bounce Rate" value={`${bounceRate.toFixed(1)}%`} icon={TrendingUp} />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <ChartCard title="Users over time">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={rows}>
                  <defs><linearGradient id="wu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} /><stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="metric_date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="total_users" stroke="var(--color-primary)" fill="url(#wu)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Sessions vs Events">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="metric_date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Legend />
                  <Bar dataKey="sessions" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="event_count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card">
      <h3 className="font-display font-semibold mb-4">{title}</h3>{children}
    </div>
  );
}
