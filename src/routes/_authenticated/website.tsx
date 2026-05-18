import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

export const Route = createFileRoute("/_authenticated/website")({ component: Page });

function Page() {
  return <NoProjectGate><Inner /></NoProjectGate>;
}
function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["wm", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("website_metrics").select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"))
        .order("metric_date");
      if (error) throw error; return data ?? [];
    },
  });
  const rows = data ?? [];
  const t = rows.reduce((a, m) => ({
    total: a.total + (m.total_users ?? 0), active: a.active + (m.active_users ?? 0),
    nu: a.nu + (m.new_users ?? 0), ru: a.ru + (m.returning_users ?? 0),
    sess: a.sess + (m.sessions ?? 0), ev: a.ev + (m.event_count ?? 0),
    eng: a.eng + (m.engagement_rate ?? 0), eng_time: a.eng_time + Number(m.avg_engagement_time ?? 0),
    bounce: a.bounce + Number(m.bounce_rate ?? 0), n: a.n + 1,
  }), { total: 0, active: 0, nu: 0, ru: 0, sess: 0, ev: 0, eng: 0, eng_time: 0, bounce: 0, n: 0 });
  const avgEng = t.n ? (t.eng / t.n).toFixed(1) + "%" : "—";
  const avgTime = t.n ? (t.eng_time / t.n).toFixed(1) + "s" : "—";
  const avgBounce = t.n ? (t.bounce / t.n).toFixed(1) + "%" : "—";

  return (
    <div className="space-y-8">
      <ModuleHeader title="Website Analytics" subtitle="GA4 web property" />
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Plug} title="No website data synced yet" description="Connect Google Analytics 4 in Settings to populate this module." actionLabel="Go to Settings" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Users" value={t.total.toLocaleString()} icon={Users} />
            <KpiCard label="Active Users" value={t.active.toLocaleString()} icon={Activity} />
            <KpiCard label="New Users" value={t.nu.toLocaleString()} icon={UserPlus} />
            <KpiCard label="Returning" value={t.ru.toLocaleString()} icon={Repeat} />
            <KpiCard label="Sessions" value={t.sess.toLocaleString()} icon={TrendingUp} />
            <KpiCard label="Events" value={t.ev.toLocaleString()} icon={MousePointer} />
            <KpiCard label="Avg Engagement" value={avgEng} hint={avgTime} icon={Clock} />
            <KpiCard label="Bounce Rate" value={avgBounce} icon={TrendingUp} />
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
