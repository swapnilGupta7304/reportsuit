import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plug, MousePointer, Users, BarChart3, Activity, Zap } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
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
import { CHANNEL_COLORS, PALETTE, PALETTE_LIST, TOOLTIP_STYLE, colorFor } from "@/lib/chart-palette";
import { ChartCard, GradientKpi } from "@/components/ChartCard";

export const Route = createFileRoute("/_authenticated/traffic-sources")({
  component: () => (
    <NoProjectGate>
      <Inner />
    </NoProjectGate>
  ),
});

const GA4_CHANNELS = [
  "Organic Search",
  "Direct",
  "Referral",
  "Organic Social",
  "Email",
  "Paid Search",
  "Organic Video",
  "Unassigned",
];

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["ts", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_sources")
        .select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = data ?? [];

  // Weighted aggregation by sessions — matches GA4 exactly
  const map = new Map<
    string,
    { sessions: number; engaged: number; engDuration: number; ev: number }
  >();
  for (const r of rows) {
    const k = r.source ?? "Unassigned";
    const e = map.get(k) ?? { sessions: 0, engaged: 0, engDuration: 0, ev: 0 };
    const s = r.sessions ?? 0;
    e.sessions += s;
    e.engaged += r.engaged_sessions ?? 0;
    e.engDuration += Number(r.avg_engagement_time_per_session ?? 0) * s;
    e.ev += r.event_count ?? 0;
    map.set(k, e);
  }
  const agg = GA4_CHANNELS.map((name) => {
    const e = map.get(name);
    if (!e || e.sessions === 0)
      return { name, sessions: 0, engaged: 0, engRate: 0, avgEng: 0, bounce: 0, eps: 0, ev: 0 };
    const engRate = (e.engaged / e.sessions) * 100;
    return {
      name,
      sessions: e.sessions,
      engaged: e.engaged,
      engRate,
      avgEng: e.engDuration / e.sessions,
      bounce: 100 - engRate,
      eps: e.ev / e.sessions,
      ev: e.ev,
    };
  }).filter((r) => r.sessions > 0 || r.name === "Direct" || r.name === "Organic Search");

  const totals = agg.reduce(
    (a, r) => {
      a.sessions += r.sessions;
      a.engaged += r.engaged;
      a.events += r.ev;
      return a;
    },
    { sessions: 0, engaged: 0, events: 0 },
  );
  const avgEng = totals.sessions ? (totals.engaged / totals.sessions) * 100 : 0;
  const avgBounce = 100 - avgEng;
  const avgEps = totals.sessions ? totals.events / totals.sessions : 0;

  const donut = agg.filter((r) => r.sessions > 0);

  const hasData = rows.length > 0;

  return (
    <div className="space-y-6">
      <ModuleHeader title="Traffic Sources" subtitle="GA4 default channel grouping" />
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !hasData ? (
        <EmptyState
          icon={Plug}
          title="No traffic source data"
          description="Connect GA4 to ingest channel-level metrics."
          actionLabel="Connect GA4"
          onAction={() => nav({ to: "/settings" })}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GradientKpi
              label="Sessions"
              value={totals.sessions.toLocaleString()}
              from={PALETTE.orange}
              to="#ffb347"
              delay={0}
            />
            <GradientKpi
              label="Engagement Rate"
              value={`${avgEng.toFixed(1)}%`}
              from={PALETTE.green}
              to="#4ade80"
              delay={0.05}
            />
            <GradientKpi
              label="Bounce Rate"
              value={`${avgBounce.toFixed(1)}%`}
              from={PALETTE.pink}
              to="#f472b6"
              delay={0.1}
            />
            <GradientKpi
              label="Events / Session"
              value={avgEps.toFixed(2)}
              hint={`${totals.events.toLocaleString()} events`}
              from={PALETTE.purple}
              to={PALETTE.blue}
              delay={0.15}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <ChartCard
              title="Sessions by channel"
              subtitle="Multi-color distribution"
              className="lg:col-span-2"
              delay={0.1}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agg} margin={{ left: -10, right: 10 }}>
                  <defs>
                    {agg.map((r, i) => (
                      <linearGradient
                        key={r.name}
                        id={`ts-bar-${i}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={colorFor(r.name, CHANNEL_COLORS, i)}
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor={colorFor(r.name, CHANNEL_COLORS, i)}
                          stopOpacity={0.55}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                  <Bar dataKey="sessions" radius={[8, 8, 0, 0]} animationDuration={800}>
                    {agg.map((r, i) => (
                      <Cell key={r.name} fill={`url(#ts-bar-${i})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Source distribution" subtitle="Share of total sessions" delay={0.15}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="sessions"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    animationDuration={900}
                  >
                    {donut.map((r, i) => (
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
            </ChartCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <ChartCard title="Engagement vs Bounce" subtitle="Per channel" delay={0.2}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={agg} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Bar dataKey="engRate" name="Engagement %" fill={PALETTE.green} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="bounce" name="Bounce %" fill={PALETTE.pink} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Event count by channel" subtitle="Total events captured" delay={0.25}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={agg} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <defs>
                    <linearGradient id="ev-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={PALETTE.cyan} />
                      <stop offset="100%" stopColor={PALETTE.purple} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="ev" name="Events" fill="url(#ev-grad)" radius={[0, 6, 6, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-2xl border bg-card shadow-card overflow-hidden"
          >
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
                {agg.map((r, i) => (
                  <TableRow key={r.name} className="hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ background: colorFor(r.name, CHANNEL_COLORS, i) }}
                        />
                        {r.name}
                      </span>
                    </TableCell>
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
          </motion.div>
        </>
      )}
    </div>
  );
}

// Silence unused imports tree-shaken in some builds
void Users;
void BarChart3;
void Activity;
void Zap;
void MousePointer;
void PALETTE_LIST;
