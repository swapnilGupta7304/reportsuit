import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Plug, Zap, Users, MousePointer } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { motion } from "framer-motion";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartCard, GradientKpi } from "@/components/ChartCard";
import { PALETTE, PALETTE_LIST, TOOLTIP_STYLE } from "@/lib/chart-palette";
import { ga4Aggregate } from "@/lib/ga4-live.functions";
import { readDim, readMetric, readTotal } from "@/lib/ga4-live";
import { IntelligencePanel } from "@/components/intelligence/IntelligencePanel";
import { Sparkles, Target, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/events")({
  component: () => (
    <NoProjectGate>
      <Inner />
    </NoProjectGate>
  ),
});

const CONVERSION_EVENTS = new Set([
  "purchase", "sign_up", "generate_lead", "begin_checkout",
  "add_to_cart", "subscribe", "donate",
]);

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const startDate = format(range.from, "yyyy-MM-dd");
  const endDate = format(range.to, "yyyy-MM-dd");
  const aggFn = useServerFn(ga4Aggregate);

  const { data: live, isLoading } = useQuery({
    queryKey: ["ev_live", currentProject!.id, startDate, endDate],
    queryFn: () =>
      aggFn({
        data: {
          projectId: currentProject!.id,
          dimensions: ["eventName"],
          metrics: ["eventCount", "totalUsers"],
          startDate, endDate,
          orderByMetric: "eventCount",
          limit: 200,
        },
      }),
  });

  const agg = (live?.rows ?? []).map((r) => ({
    event_name: readDim(live!, r, "eventName"),
    event_count: readMetric(live!, r, "eventCount"),
    users: readMetric(live!, r, "totalUsers"),
  }));
  const chart = agg.slice(0, 12);

  const totals = {
    events: live ? readTotal(live, "eventCount") : 0,
    users: live ? readTotal(live, "totalUsers") : 0,
    conv: agg.reduce((s, e) => s + (CONVERSION_EVENTS.has(e.event_name) ? e.event_count : 0), 0),
  };

  return (
    <div className="space-y-6">
      <ModuleHeader title="Top Events" subtitle="GA4 eventName — live API values" />
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : agg.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No event data"
          description="Connect GA4 to view event analytics."
          actionLabel="Connect GA4"
          onAction={() => nav({ to: "/settings" })}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GradientKpi label="Total Events" value={totals.events.toLocaleString()} from={PALETTE.orange} to={PALETTE.pink} delay={0} />
            <GradientKpi label="Unique Event Types" value={agg.length} from={PALETTE.blue} to={PALETTE.cyan} delay={0.05} />
            <GradientKpi label="Total Users" value={totals.users.toLocaleString()} from={PALETTE.purple} to={PALETTE.pink} delay={0.1} />
            <GradientKpi label="Conversion Events" value={totals.conv.toLocaleString()} from={PALETTE.green} to={PALETTE.teal} delay={0.15} />
          </div>

          <ChartCard title="Top 12 events" subtitle="Event count — gradient bars" delay={0.1}>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={chart} layout="vertical" margin={{ left: 10, right: 30 }}>
                <defs>
                  {chart.map((_, i) => (
                    <linearGradient key={i} id={`ev-bar-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={PALETTE_LIST[i % PALETTE_LIST.length]} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={PALETTE_LIST[(i + 2) % PALETTE_LIST.length]} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="event_name" type="category" width={160} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                <Bar dataKey="event_count" radius={[0, 8, 8, 0]} animationDuration={900}>
                  {chart.map((_, i) => (
                    <Cell key={i} fill={`url(#ev-bar-${i})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="rounded-2xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agg.map((r, i) => {
                  const isConv = CONVERSION_EVENTS.has(r.event_name);
                  return (
                    <TableRow key={r.event_name} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block size-2.5 rounded-full" style={{ background: PALETTE_LIST[i % PALETTE_LIST.length] }} />
                          {r.event_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{r.event_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.users.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {isConv ? (
                          <Badge className="bg-success/15 text-success border-success/30">Conversion</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Standard</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </>
      )}
    </div>
  );
}

void Zap;
void Users;
void MousePointer;
