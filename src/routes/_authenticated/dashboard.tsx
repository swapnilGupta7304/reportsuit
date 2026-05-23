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
  Award,
  Globe2,
  Sparkles,
  Target,
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
import { useServerFn } from "@tanstack/react-start";
import { format, differenceInCalendarDays, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { EmptyState } from "@/components/EmptyState";
import { ChartCard, GradientKpi } from "@/components/ChartCard";
import { CHANNEL_COLORS, PALETTE, PALETTE_LIST, TOOLTIP_STYLE, colorFor } from "@/lib/chart-palette";
import { ga4Aggregate } from "@/lib/ga4-live.functions";
import { readTotal, readDim, readMetric } from "@/lib/ga4-live";
import { compare, executiveSummary, buildAlerts, qualityScore } from "@/lib/intelligence";
import { ExecutiveSummary } from "@/components/intelligence/ExecutiveSummary";
import { SmartAlerts } from "@/components/intelligence/SmartAlerts";
import { SmartInsightCard } from "@/components/intelligence/SmartInsightCard";
import { QualityBadge } from "@/components/intelligence/QualityBadge";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Page });

function Page() {
  const { currentProject, projects, isLoading } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const startDate = format(range.from, "yyyy-MM-dd");
  const endDate = format(range.to, "yyyy-MM-dd");

  // Previous-period date range (same length, immediately before)
  const days = Math.max(1, differenceInCalendarDays(range.to, range.from) + 1);
  const prevEnd = subDays(range.from, 1);
  const prevStart = subDays(prevEnd, days - 1);
  const prevStartDate = format(prevStart, "yyyy-MM-dd");
  const prevEndDate = format(prevEnd, "yyyy-MM-dd");

  const aggFn = useServerFn(ga4Aggregate);
  const totalsMetrics = [
    "totalUsers", "activeUsers", "newUsers",
    "sessions", "engagedSessions", "engagementRate",
    "bounceRate", "userEngagementDuration", "eventCount",
  ];

  const { data: live } = useQuery({
    queryKey: ["dash_live", currentProject?.id, startDate, endDate],
    enabled: !!currentProject,
    queryFn: () =>
      aggFn({
        data: {
          projectId: currentProject!.id,
          dimensions: [],
          metrics: totalsMetrics,
          startDate, endDate,
        },
      }),
  });

  const { data: prev } = useQuery({
    queryKey: ["dash_prev", currentProject?.id, prevStartDate, prevEndDate],
    enabled: !!currentProject,
    queryFn: () =>
      aggFn({
        data: {
          projectId: currentProject!.id,
          dimensions: [],
          metrics: totalsMetrics,
          startDate: prevStartDate, endDate: prevEndDate,
        },
      }),
  });

  const { data: channelsLive } = useQuery({
    queryKey: ["dash_ch_live", currentProject?.id, startDate, endDate],
    enabled: !!currentProject,
    queryFn: () => aggFn({ data: {
      projectId: currentProject!.id,
      dimensions: ["sessionPrimaryChannelGroup"],
      metrics: ["sessions", "engagedSessions", "engagementRate", "bounceRate", "averageSessionDuration", "eventsPerSession"],
      startDate, endDate, orderByMetric: "sessions", limit: 50,
    }}),
  });

  const { data: channelsPrev } = useQuery({
    queryKey: ["dash_ch_prev", currentProject?.id, prevStartDate, prevEndDate],
    enabled: !!currentProject,
    queryFn: () => aggFn({ data: {
      projectId: currentProject!.id,
      dimensions: ["sessionPrimaryChannelGroup"],
      metrics: ["sessions"],
      startDate: prevStartDate, endDate: prevEndDate, orderByMetric: "sessions", limit: 50,
    }}),
  });

  const { data: countriesLive } = useQuery({
    queryKey: ["dash_geo_live", currentProject?.id, startDate, endDate],
    enabled: !!currentProject,
    queryFn: () => aggFn({ data: {
      projectId: currentProject!.id,
      dimensions: ["country"],
      metrics: ["sessions"],
      startDate, endDate, orderByMetric: "sessions", limit: 10,
    }}),
  });

  const { data: devicesLive } = useQuery({
    queryKey: ["dash_dev_live", currentProject?.id, startDate, endDate],
    enabled: !!currentProject,
    queryFn: () => aggFn({ data: {
      projectId: currentProject!.id,
      dimensions: ["deviceCategory"],
      metrics: ["sessions", "totalUsers"],
      startDate, endDate, orderByMetric: "sessions", limit: 10,
    }}),
  });

  const { data: topPagesLive } = useQuery({
    queryKey: ["dash_pages_live", currentProject?.id, startDate, endDate],
    enabled: !!currentProject,
    queryFn: () => aggFn({ data: {
      projectId: currentProject!.id,
      dimensions: ["pagePath"],
      metrics: ["screenPageViews", "activeUsers", "bounceRate", "userEngagementDuration"],
      startDate, endDate, orderByMetric: "screenPageViews", limit: 25,
    }}),
  });



  const { data: metrics } = useQuery({
    queryKey: ["website_metrics", currentProject?.id, range.from, range.to],
    enabled: !!currentProject,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_metrics")
        .select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", startDate)
        .lte("metric_date", endDate)
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
        .gte("metric_date", startDate)
        .lte("metric_date", endDate);
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

  // EXACT GA4 totals from live aggregate (no per-day summing)
  const totalUsersLive = live ? readTotal(live, "totalUsers") : 0;
  const activeUsersLive = live ? readTotal(live, "activeUsers") : 0;
  const newUsersLive = live ? readTotal(live, "newUsers") : 0;
  const sessionsLive = live ? readTotal(live, "sessions") : 0;
  const engagedLive = live ? readTotal(live, "engagedSessions") : 0;
  const eventsLive = live ? readTotal(live, "eventCount") : 0;
  const totals = {
    users: totalUsersLive,
    active: activeUsersLive,
    newU: newUsersLive,
    ret: Math.max(0, totalUsersLive - newUsersLive),
    sessions: sessionsLive,
    events: eventsLive,
    organic: 0,
  };

  const avgEng = sessionsLive > 0 ? (engagedLive / sessionsLive) * 100 : 0;
  const avgBounce = 100 - avgEng;
  const avgDurSec = sessionsLive > 0 ? (live ? readTotal(live, "userEngagementDuration") : 0) / sessionsLive : 0;
  const eps = sessionsLive > 0 ? eventsLive / sessionsLive : 0;

  // Previous-period totals
  const pTotal = prev ? readTotal(prev, "totalUsers") : 0;
  const pActive = prev ? readTotal(prev, "activeUsers") : 0;
  const pNew = prev ? readTotal(prev, "newUsers") : 0;
  const pSessions = prev ? readTotal(prev, "sessions") : 0;
  const pEngaged = prev ? readTotal(prev, "engagedSessions") : 0;
  const pEngRate = pSessions > 0 ? (pEngaged / pSessions) * 100 : 0;
  const pBounce = pSessions > 0 ? 100 - pEngRate : 0;

  const dTotal = compare(totalUsersLive, pTotal);
  const dActive = compare(activeUsersLive, pActive);
  const dNew = compare(newUsersLive, pNew);
  const dSessions = compare(sessionsLive, pSessions);
  const dEng = compare(avgEng, pEngRate);
  const dBounce = compare(avgBounce, pBounce, true);

  // Channel rows + previous-period channel comparison
  const channelRows = (channelsLive?.rows ?? []).map((r) => ({
    name: readDim(channelsLive!, r, "sessionPrimaryChannelGroup") || "Unassigned",
    sessions: readMetric(channelsLive!, r, "sessions"),
    engRate: readMetric(channelsLive!, r, "engagementRate") * 100,
    bounce: readMetric(channelsLive!, r, "bounceRate") * 100,
    avgDur: readMetric(channelsLive!, r, "averageSessionDuration"),
    eps: readMetric(channelsLive!, r, "eventsPerSession"),
  }));
  const prevChannelMap = new Map<string, number>();
  for (const r of channelsPrev?.rows ?? []) {
    prevChannelMap.set(readDim(channelsPrev!, r, "sessionPrimaryChannelGroup") || "Unassigned", readMetric(channelsPrev!, r, "sessions"));
  }
  const channelDeltas = channelRows.map((c) => ({ name: c.name, sessions: compare(c.sessions, prevChannelMap.get(c.name) ?? 0) }));

  const topChannel = channelRows[0];
  const topChannelShare = sessionsLive > 0 && topChannel ? topChannel.sessions / sessionsLive : 0;
  const topChannelQuality = topChannel ? qualityScore({
    engagementRate: topChannel.engRate, bounceRate: topChannel.bounce,
    avgEngagementSec: topChannel.avgDur, eventsPerSession: topChannel.eps,
  }) : null;

  const topCountryRow = countriesLive?.rows?.[0];
  const topCountry = topCountryRow ? {
    name: readDim(countriesLive!, topCountryRow, "country") || "Unknown",
    sessions: readMetric(countriesLive!, topCountryRow, "sessions"),
  } : undefined;

  const deviceTotalSessions = (devicesLive?.rows ?? []).reduce((s, r) => s + readMetric(devicesLive!, r, "sessions"), 0);
  const topDeviceRow = devicesLive?.rows?.[0];
  const topDevice = topDeviceRow && deviceTotalSessions > 0 ? {
    name: readDim(devicesLive!, topDeviceRow, "deviceCategory") || "unknown",
    share: readMetric(devicesLive!, topDeviceRow, "sessions") / deviceTotalSessions,
  } : undefined;

  // Best performing page (highest engagement, ≥1% of traffic share)
  const pageRows = (topPagesLive?.rows ?? []).map((r) => {
    const dur = readMetric(topPagesLive!, r, "userEngagementDuration");
    const au = readMetric(topPagesLive!, r, "activeUsers");
    return {
      path: readDim(topPagesLive!, r, "pagePath"),
      pv: readMetric(topPagesLive!, r, "screenPageViews"),
      au,
      bounce: readMetric(topPagesLive!, r, "bounceRate") * 100,
      engPerUser: au > 0 ? dur / au : 0,
    };
  });
  const maxAU = Math.max(1, ...pageRows.map((p) => p.au));
  const bestPage = [...pageRows].sort((a, b) => b.engPerUser - a.engPerUser).find((p) => p.au / maxAU >= 0.05);
  const worstPage = [...pageRows].sort((a, b) => b.bounce - a.bounce).find((p) => p.au / maxAU >= 0.05);

  // Executive narrative + alerts
  const summary = executiveSummary({
    totalUsers: dTotal, sessions: dSessions, newUsers: dNew,
    engagementRate: dEng, bounceRate: dBounce,
    topChannel: topChannel ? { name: topChannel.name, share: topChannelShare } : undefined,
    topCountry, topDevice,
  });
  const alerts = buildAlerts({
    totalUsers: dTotal, sessions: dSessions, newUsers: dNew,
    engagementRate: dEng, bounceRate: dBounce,
    channels: channelDeltas,
  });

  const sourceMap = new Map<string, number>();
  for (const r of sources ?? []) {
    sourceMap.set(r.source ?? "Unassigned", (sourceMap.get(r.source ?? "Unassigned") ?? 0) + (r.sessions ?? 0));
  }
  const sourcePie = [...sourceMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const hasData = sessionsLive > 0 || series.length > 0;
  void Award;


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

      {/* ─── Executive Summary ─── */}
      <ExecutiveSummary bullets={summary} />

      {/* ─── Traffic Quality Index (custom KPI) ─── */}
      {topChannel && topChannelQuality && (
        <div className="rounded-2xl border bg-gradient-to-br from-card to-primary-soft/20 p-5 shadow-card flex flex-wrap items-center gap-4">
          <div className="size-10 rounded-xl gradient-primary text-primary-foreground grid place-items-center">
            <Award className="size-5" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Traffic Quality Index</div>
            <div className="font-display text-2xl font-bold mt-0.5">
              {qualityScore({ engagementRate: avgEng, bounceRate: avgBounce, avgEngagementSec: avgDurSec, eventsPerSession: eps }).score}
              <span className="text-base font-normal text-muted-foreground"> / 100</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Weighted: engagement, bounce, duration, events/session</div>
          </div>
          <QualityBadge q={qualityScore({ engagementRate: avgEng, bounceRate: avgBounce, avgEngagementSec: avgDurSec, eventsPerSession: eps })} />
          <div className="hidden md:block h-10 w-px bg-border" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Top channel</div>
            <div className="text-sm font-semibold">{topChannel.name} · {(topChannelShare * 100).toFixed(0)}%</div>
          </div>
        </div>
      )}

      {/* ─── Smart Insight Cards ─── */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {topChannel && (
          <SmartInsightCard
            icon={Target}
            accent={PALETTE.orange}
            label="Highest performing channel"
            headline={topChannel.name}
            detail={`${topChannel.sessions.toLocaleString()} sessions (${(topChannelShare * 100).toFixed(0)}% share) · ${topChannel.engRate.toFixed(0)}% engagement`}
            pct={channelDeltas.find((c) => c.name === topChannel.name)?.sessions.pct}
            recommendation="Sustain investment and expand creative variants on this channel."
            delay={0}
          />
        )}
        {topCountry && (
          <SmartInsightCard
            icon={Globe2}
            accent={PALETTE.blue}
            label="Fastest growing geography"
            headline={topCountry.name}
            detail={`${topCountry.sessions.toLocaleString()} sessions from this market in the selected period.`}
            recommendation="Localize content and consider geo-targeted campaigns."
            delay={0.05}
          />
        )}
        {bestPage && (
          <SmartInsightCard
            icon={Sparkles}
            accent={PALETTE.purple}
            label="Most engaging page"
            headline={bestPage.path}
            detail={`${bestPage.engPerUser.toFixed(0)}s avg engagement per user · ${bestPage.au.toLocaleString()} active users.`}
            recommendation="Mirror this page's structure on lower-performing pages."
            delay={0.1}
          />
        )}
        {worstPage && worstPage.bounce > 60 && (
          <SmartInsightCard
            icon={Activity}
            accent={PALETTE.pink}
            label="Highest bounce page"
            headline={worstPage.path}
            detail={`${worstPage.bounce.toFixed(0)}% bounce rate — visitors leaving without engaging.`}
            recommendation="Audit page speed, intent match, and primary CTA."
            delay={0.15}
          />
        )}
      </div>

      {/* ─── Smart Alerts ─── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-lg">Smart Alerts</h2>
          <span className="text-xs text-muted-foreground">vs previous {days} days</span>
        </div>
        <SmartAlerts alerts={alerts} />
      </section>



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
