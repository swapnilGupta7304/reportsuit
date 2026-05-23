import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import { Globe2, Target, Sparkles, Activity, TrendingUp, AlertTriangle } from "lucide-react";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { Skeleton } from "@/components/ui/skeleton";
import { ga4Aggregate } from "@/lib/ga4-live.functions";
import { readDim, readMetric, readTotal } from "@/lib/ga4-live";
import {
  compare, qualityScore, executiveSummary, buildAlerts,
} from "@/lib/intelligence";
import { ExecutiveSummary } from "@/components/intelligence/ExecutiveSummary";
import { SmartAlerts } from "@/components/intelligence/SmartAlerts";
import { SmartInsightCard } from "@/components/intelligence/SmartInsightCard";
import { QualityBadge } from "@/components/intelligence/QualityBadge";
import { PALETTE } from "@/lib/chart-palette";

export const Route = createFileRoute("/_authenticated/insights")({
  component: () => <NoProjectGate><Inner /></NoProjectGate>,
});

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const startDate = format(range.from, "yyyy-MM-dd");
  const endDate = format(range.to, "yyyy-MM-dd");
  const days = Math.max(1, differenceInCalendarDays(range.to, range.from) + 1);
  const prevEnd = subDays(range.from, 1);
  const prevStart = subDays(prevEnd, days - 1);
  const prevStartDate = format(prevStart, "yyyy-MM-dd");
  const prevEndDate = format(prevEnd, "yyyy-MM-dd");

  const aggFn = useServerFn(ga4Aggregate);
  const totalsMetrics = [
    "totalUsers", "newUsers", "sessions", "engagedSessions",
    "engagementRate", "bounceRate", "userEngagementDuration", "eventCount",
  ];

  const { data: live, isLoading } = useQuery({
    queryKey: ["ins_live", currentProject!.id, startDate, endDate],
    queryFn: () => aggFn({ data: { projectId: currentProject!.id, dimensions: [], metrics: totalsMetrics, startDate, endDate } }),
  });
  const { data: prev } = useQuery({
    queryKey: ["ins_prev", currentProject!.id, prevStartDate, prevEndDate],
    queryFn: () => aggFn({ data: { projectId: currentProject!.id, dimensions: [], metrics: totalsMetrics, startDate: prevStartDate, endDate: prevEndDate } }),
  });
  const { data: channels } = useQuery({
    queryKey: ["ins_ch", currentProject!.id, startDate, endDate],
    queryFn: () => aggFn({ data: {
      projectId: currentProject!.id,
      dimensions: ["sessionPrimaryChannelGroup"],
      metrics: ["sessions", "engagementRate", "bounceRate", "averageSessionDuration", "eventsPerSession"],
      startDate, endDate, orderByMetric: "sessions", limit: 50,
    } }),
  });
  const { data: channelsPrev } = useQuery({
    queryKey: ["ins_ch_prev", currentProject!.id, prevStartDate, prevEndDate],
    queryFn: () => aggFn({ data: {
      projectId: currentProject!.id,
      dimensions: ["sessionPrimaryChannelGroup"],
      metrics: ["sessions"],
      startDate: prevStartDate, endDate: prevEndDate, orderByMetric: "sessions", limit: 50,
    } }),
  });
  const { data: countries } = useQuery({
    queryKey: ["ins_geo", currentProject!.id, startDate, endDate],
    queryFn: () => aggFn({ data: {
      projectId: currentProject!.id, dimensions: ["country"], metrics: ["sessions"],
      startDate, endDate, orderByMetric: "sessions", limit: 5,
    } }),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  const total = live ? readTotal(live, "totalUsers") : 0;
  const newU = live ? readTotal(live, "newUsers") : 0;
  const sess = live ? readTotal(live, "sessions") : 0;
  const eng = live ? readTotal(live, "engagedSessions") : 0;
  const dur = live ? readTotal(live, "userEngagementDuration") : 0;
  const ev = live ? readTotal(live, "eventCount") : 0;
  const engRate = sess > 0 ? (eng / sess) * 100 : 0;
  const bounce = sess > 0 ? 100 - engRate : 0;
  const avgDur = sess > 0 ? dur / sess : 0;
  const eps = sess > 0 ? ev / sess : 0;

  const pTotal = prev ? readTotal(prev, "totalUsers") : 0;
  const pNew = prev ? readTotal(prev, "newUsers") : 0;
  const pSess = prev ? readTotal(prev, "sessions") : 0;
  const pEng = prev ? readTotal(prev, "engagedSessions") : 0;
  const pEngRate = pSess > 0 ? (pEng / pSess) * 100 : 0;
  const pBounce = pSess > 0 ? 100 - pEngRate : 0;

  const channelRows = (channels?.rows ?? []).map((r) => ({
    name: readDim(channels!, r, "sessionPrimaryChannelGroup") || "Unassigned",
    sessions: readMetric(channels!, r, "sessions"),
    engRate: readMetric(channels!, r, "engagementRate") * 100,
    bounce: readMetric(channels!, r, "bounceRate") * 100,
    avgDur: readMetric(channels!, r, "averageSessionDuration"),
    eps: readMetric(channels!, r, "eventsPerSession"),
  }));
  const prevChMap = new Map<string, number>();
  for (const r of channelsPrev?.rows ?? []) {
    prevChMap.set(readDim(channelsPrev!, r, "sessionPrimaryChannelGroup") || "Unassigned", readMetric(channelsPrev!, r, "sessions"));
  }
  const channelDeltas = channelRows.map((c) => ({ name: c.name, sessions: compare(c.sessions, prevChMap.get(c.name) ?? 0) }));

  const topChannel = channelRows[0];
  const topChannelShare = sess > 0 && topChannel ? topChannel.sessions / sess : 0;
  const topCountryRow = countries?.rows?.[0];
  const topCountry = topCountryRow ? {
    name: readDim(countries!, topCountryRow, "country") || "Unknown",
    sessions: readMetric(countries!, topCountryRow, "sessions"),
  } : undefined;

  const summary = executiveSummary({
    totalUsers: compare(total, pTotal),
    sessions: compare(sess, pSess),
    newUsers: compare(newU, pNew),
    engagementRate: compare(engRate, pEngRate),
    bounceRate: compare(bounce, pBounce, true),
    topChannel: topChannel ? { name: topChannel.name, share: topChannelShare } : undefined,
    topCountry,
  });
  const alerts = buildAlerts({
    totalUsers: compare(total, pTotal),
    sessions: compare(sess, pSess),
    newUsers: compare(newU, pNew),
    engagementRate: compare(engRate, pEngRate),
    bounceRate: compare(bounce, pBounce, true),
    channels: channelDeltas,
  });

  const ecosystemQuality = qualityScore({
    engagementRate: engRate, bounceRate: bounce, avgEngagementSec: avgDur, eventsPerSession: eps,
  });

  // Best & worst channels by quality
  const ranked = channelRows
    .filter((c) => c.sessions > 50)
    .map((c) => ({
      ...c,
      q: qualityScore({ engagementRate: c.engRate, bounceRate: c.bounce, avgEngagementSec: c.avgDur, eventsPerSession: c.eps }),
      delta: channelDeltas.find((d) => d.name === c.name)?.sessions,
    }));
  const bestChannel = [...ranked].sort((a, b) => b.q.score - a.q.score)[0];
  const decliningChannel = [...ranked].sort((a, b) => (a.delta?.pct ?? 0) - (b.delta?.pct ?? 0))[0];

  return (
    <div className="space-y-6">
      <ModuleHeader title="Executive Insights" subtitle="Decision intelligence across the digital ecosystem" />

      {/* Ecosystem Quality KPI */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-card flex flex-wrap items-center gap-5">
        <div className="size-14 rounded-2xl gradient-primary text-primary-foreground grid place-items-center">
          <Sparkles className="size-6" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Digital Ecosystem Health</div>
          <div className="font-display text-4xl font-bold mt-1">
            {ecosystemQuality.score}<span className="text-xl font-normal text-muted-foreground"> / 100</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Composite score across engagement, bounce, duration and events per session.
          </p>
        </div>
        <QualityBadge q={ecosystemQuality} />
      </div>

      <ExecutiveSummary bullets={summary} />

      <section>
        <h2 className="font-display font-semibold text-lg mb-3">Smart Alerts</h2>
        <SmartAlerts alerts={alerts} />
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg mb-3">Opportunities & Watchlist</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bestChannel && (
            <SmartInsightCard
              icon={Target} accent={PALETTE.green}
              label="Best performing channel"
              headline={`${bestChannel.name} · ${bestChannel.q.label}`}
              detail={`Quality ${bestChannel.q.score}/100, ${bestChannel.sessions.toLocaleString()} sessions, ${bestChannel.engRate.toFixed(0)}% engagement.`}
              pct={bestChannel.delta?.pct}
              recommendation="Increase budget allocation and replicate the messaging on adjacent channels."
            />
          )}
          {decliningChannel && (decliningChannel.delta?.pct ?? 0) < -10 && (
            <SmartInsightCard
              icon={AlertTriangle} accent={PALETTE.pink}
              label="Channel needing attention"
              headline={decliningChannel.name}
              detail={`Sessions trending down. Quality currently ${decliningChannel.q.label}.`}
              pct={decliningChannel.delta?.pct}
              recommendation="Audit referrers, links, UTM tagging and campaign status."
              delay={0.05}
            />
          )}
          {topCountry && (
            <SmartInsightCard
              icon={Globe2} accent={PALETTE.blue}
              label="Geography spotlight"
              headline={topCountry.name}
              detail={`${topCountry.sessions.toLocaleString()} sessions — your leading market.`}
              recommendation="Localize key landing pages and tailor content for this audience."
              delay={0.1}
            />
          )}
          <SmartInsightCard
            icon={TrendingUp} accent={PALETTE.purple}
            label="Acquisition velocity"
            headline={`${newU.toLocaleString()} new users`}
            detail={`vs ${pNew.toLocaleString()} prior period.`}
            pct={pNew > 0 ? ((newU - pNew) / pNew) * 100 : 0}
            recommendation="Map the strongest acquisition source to your top conversion page."
            delay={0.15}
          />
          <SmartInsightCard
            icon={Activity} accent={PALETTE.orange}
            label="Engagement health"
            headline={`${engRate.toFixed(1)}% engagement`}
            detail={`Avg session ${avgDur.toFixed(0)}s · ${eps.toFixed(1)} events/session.`}
            pct={pEngRate > 0 ? ((engRate - pEngRate) / pEngRate) * 100 : 0}
            recommendation="Push the most engaging content above the fold on key pages."
            delay={0.2}
          />
        </div>
      </section>
    </div>
  );
}
