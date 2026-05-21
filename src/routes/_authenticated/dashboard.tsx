import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Activity,
  UserPlus,
  Repeat,
  MousePointer,
  TrendingUp,
  Smartphone,
  FolderKanban,
  Plug,
  Radio,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ChartCard, GradientKpi } from "@/components/ChartCard";
import { CHANNEL_COLORS, PALETTE, PALETTE_LIST, TOOLTIP_STYLE, colorFor } from "@/lib/chart-palette";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Page });

function Page() {
  const { currentProject, projects, isLoading } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();

  const { data: metrics } = useQuery({
    queryKey: ["website_metrics", currentProject?.id, range.from, range.to],
    enabled: !!currentProject,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_metrics")
        .select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"))
        .order("metric_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sources } = useQuery({
    queryKey: ["dash_sources", currentProject?.id, range.from, range.to],
    enabled: !!currentProject,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_sources")
        .select("source, sessions, engaged_sessions")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isLoading && projects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto pt-8">
        <EmptyState
          icon={FolderKanban}
          title="Create your first project"
          description="Add a website, mobile app, or both to start tracking analytics across Chinmaya Mission properties."
          actionLabel="Add project"
          onAction={() => nav({ to: "/projects" })}
        />
      </div>
    );
  }

  const series = (metrics ?? []).map((m) => ({
    date: m.metric_date,
    label: m.metric_date ? format(new Date(m.metric_date), "MMM d") : "",
    total_users: m.total_users ?? 0,
    active_users: m.active_users ?? 0,
    new_users: m.new_users ?? 0,
    returning_users: m.returning_users ?? 0,
    sessions: m.sessions ?? 0,
    events: m.event_count ?? 0,
    organic: m.organic_traffic ?? 0,
    bounce: Number(m.bounce_rate ?? 0),
    engagement: Number(m.engagement_rate ?? 0),
  }));

  const totals = series.reduce(
    (a, m) => ({
      users: a.users + m.total_users,
      active: a.active + m.active_users,
      newU: a.newU + m.new_users,
      ret: a.ret + m.returning_users,
      sessions: a.sessions + m.sessions,
      events: a.events + m.events,
      organic: a.organic + m.organic,
    }),
    { users: 0, active: 0, newU: 0, ret: 0, sessions: 0, events: 0, organic: 0 },
  );

  const avgBounce =
    series.length > 0 ? series.reduce((s, x) => s + x.bounce, 0) / series.length : 0;
  const avgEng =
    series.length > 0 ? series.reduce((s, x) => s + x.engagement, 0) / series.length : 0;

  const sourceMap = new Map<string, number>();
  for (const r of sources ?? []) {
    sourceMap.set(r.source ?? "Unassigned", (sourceMap.get(r.source ?? "Unassigned") ?? 0) + (r.sessions ?? 0));
  }
  const sourcePie = [...sourceMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const hasData = series.length > 0;

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-display text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {currentProject?.name} · {format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <Radio className="size-3 text-muted-foreground" />
          Live sync
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientKpi label="Total Users" value={totals.users.toLocaleString()} from={PALETTE.orange} to="#ffb347" delay={0} />
        <GradientKpi label="Active Users" value={totals.active.toLocaleString()} from={PALETTE.blue} to={PALETTE.cyan} delay={0.05} />
        <GradientKpi label="New Users" value={totals.newU.toLocaleString()} from={PALETTE.purple} to={PALETTE.pink} delay={0.1} />
        <GradientKpi label="Returning" value={totals.ret.toLocaleString()} from={PALETTE.green} to={PALETTE.teal} delay={0.15} />
        <GradientKpi label="Sessions" value={totals.sessions.toLocaleString()} from={PALETTE.pink} to={PALETTE.orange} delay={0.2} />
        <GradientKpi label="Events" value={totals.events.toLocaleString()} from={PALETTE.indigo} to={PALETTE.purple} delay={0.25} />
        <GradientKpi label="Organic Traffic" value={totals.organic.toLocaleString()} from={PALETTE.teal} to={PALETTE.green} delay={0.3} />
        <GradientKpi label="Engagement" value={`${avgEng.toFixed(1)}%`} from={PALETTE.yellow} to={PALETTE.orange} delay={0.35} />
      </div>

      {hasData ? (
        <>
          <div className="grid lg:grid-cols-3 gap-6">
            <ChartCard
              title="Users trend"
              subtitle="Total · Active · New · Returning"
              className="lg:col-span-2"
              delay={0.1}
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="d-total" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE.orange} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={PALETTE.orange} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="d-active" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE.blue} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={PALETTE.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="d-new" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE.purple} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={PALETTE.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Area type="monotone" dataKey="total_users" name="Total" stroke={PALETTE.orange} fill="url(#d-total)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="active_users" name="Active" stroke={PALETTE.blue} fill="url(#d-active)" strokeWidth={2} />
                  <Area type="monotone" dataKey="new_users" name="New" stroke={PALETTE.purple} fill="url(#d-new)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Traffic sources" subtitle="Share of sessions" delay={0.15}>
              {sourcePie.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sourcePie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      animationDuration={900}
                    >
                      {sourcePie.map((r, i) => (
                        <Cell
                          key={r.name}
                          fill={colorFor(r.name, CHANNEL_COLORS, i)}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] grid place-items-center text-sm text-muted-foreground">No source data yet</div>
              )}
            </ChartCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <ChartCard title="Traffic growth" subtitle="Sessions over time" delay={0.2}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="d-sess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE.pink} stopOpacity={0.7} />
                      <stop offset="100%" stopColor={PALETTE.orange} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="sessions" stroke={PALETTE.pink} fill="url(#d-sess)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Engagement vs Bounce" subtitle={`Avg ${avgEng.toFixed(1)}% / ${avgBounce.toFixed(1)}%`} delay={0.25}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Line type="monotone" dataKey="engagement" name="Engagement" stroke={PALETTE.green} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="bounce" name="Bounce" stroke={PALETTE.pink} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Returning vs New users" subtitle="Daily mix" delay={0.3}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={series} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.25 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="new_users" stackId="u" name="New" fill={PALETTE.purple} radius={[0, 0, 0, 0]} />
                <Bar dataKey="returning_users" stackId="u" name="Returning" fill={PALETTE.green} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      ) : (
        <EmptyState
          icon={Plug}
          title="No analytics data yet"
          description="Connect Google Analytics 4 to start syncing real metrics for this project."
          actionLabel="Connect GA4"
          onAction={() => nav({ to: "/settings" })}
        />
      )}
    </div>
  );
}

void Users;
void Activity;
void UserPlus;
void Repeat;
void MousePointer;
void TrendingUp;
void Smartphone;
void PALETTE_LIST;
