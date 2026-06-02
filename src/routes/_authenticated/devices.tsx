import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Plug } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
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
import { ChartCard } from "@/components/ChartCard";
import { DEVICE_COLORS, OS_COLORS, PALETTE_LIST, TOOLTIP_STYLE, colorFor } from "@/lib/chart-palette";
import { ga4Aggregate } from "@/lib/ga4-live.functions";
import { readDim, readMetric } from "@/lib/ga4-live";
import { IntelligencePanel } from "@/components/intelligence/IntelligencePanel";
import { Smartphone, Monitor, Sparkles } from "lucide-react";
import { PALETTE } from "@/lib/chart-palette";

export const Route = createFileRoute("/_authenticated/devices")({
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
  const startDate = format(range.from, "yyyy-MM-dd");
  const endDate = format(range.to, "yyyy-MM-dd");
  const aggFn = useServerFn(ga4Aggregate);

  const { data: liveCat, isLoading: l1 } = useQuery({
    queryKey: ["dev_cat_live", currentProject!.id, startDate, endDate],
    queryFn: () =>
      aggFn({
        data: {
          projectId: currentProject!.id,
          dimensions: ["deviceCategory"],
          metrics: ["activeUsers", "engagedSessions"],
          startDate, endDate,
          orderByMetric: "activeUsers",
        },
      }),
  });
  const { data: liveOs, isLoading: l2 } = useQuery({
    queryKey: ["dev_os_live", currentProject!.id, startDate, endDate],
    queryFn: () =>
      aggFn({
        data: {
          projectId: currentProject!.id,
          dimensions: ["operatingSystem"],
          metrics: ["activeUsers", "engagedSessions"],
          startDate, endDate,
          orderByMetric: "activeUsers",
          limit: 50,
        },
      }),
  });

  const byCat = (liveCat?.rows ?? []).map((r) => ({
    key: readDim(liveCat!, r, "deviceCategory") || "Unknown",
    users: readMetric(liveCat!, r, "activeUsers"),
    sessions: readMetric(liveCat!, r, "engagedSessions"),
  }));
  const byOs = (liveOs?.rows ?? []).map((r) => ({
    key: readDim(liveOs!, r, "operatingSystem") || "Unknown",
    users: readMetric(liveOs!, r, "activeUsers"),
    sessions: readMetric(liveOs!, r, "engagedSessions"),
  }));

  const isLoading = l1 || l2;
  const hasData = byCat.length > 0 || byOs.length > 0;

  return (
    <div className="space-y-6">
      <ModuleHeader title="Devices" subtitle="GA4 deviceCategory & operatingSystem — live values" />
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !hasData ? (
        <EmptyState
          icon={Plug}
          title="No device data"
          description="Connect GA4 to view device breakdown."
          actionLabel="Connect GA4"
          onAction={() => nav({ to: "/settings" })}
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <DonutCard title="Device category" subtitle="Mobile · Desktop · Tablet" rows={byCat} colorMap={DEVICE_COLORS} gradientId="dev-cat" delay={0} />
          <DonutCard title="Operating system" subtitle="Active users by OS" rows={byOs} colorMap={OS_COLORS} gradientId="dev-os" delay={0.1} />
        </div>
      )}
    </div>
  );
}

function DonutCard({
  title, subtitle, rows, colorMap, gradientId, delay,
}: {
  title: string;
  subtitle: string;
  rows: { key: string; users: number; sessions: number }[];
  colorMap: Record<string, string>;
  gradientId: string;
  delay: number;
}) {
  const total = rows.reduce((s, r) => s + r.users, 0);
  return (
    <ChartCard title={title} subtitle={subtitle} delay={delay}>
      <div className="relative">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={rows} dataKey="users" nameKey="key" innerRadius={70} outerRadius={100} paddingAngle={3} animationDuration={900}>
              {rows.map((r, i) => (
                <Cell key={r.key} fill={colorFor(r.key, colorMap, i)} stroke="hsl(var(--background))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -mt-7">
          <div className="text-xs text-muted-foreground">Active Users</div>
          <div className="font-display text-2xl font-bold tabular-nums">{total.toLocaleString()}</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 28)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 20, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="key" type="category" width={90} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="users" radius={[0, 6, 6, 0]} animationDuration={900}>
            {rows.map((r, i) => (
              <Cell key={r.key} fill={colorFor(r.key, colorMap, i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{title.includes("OS") || title.includes("system") ? "OS" : "Category"}</TableHead>
            <TableHead className="text-right">Active Users</TableHead>
            <TableHead className="text-right">Share</TableHead>
            <TableHead className="text-right">Engaged Sessions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <motion.tr key={r.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i, duration: 0.3 }} className="border-b last:border-0">
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: colorFor(r.key, colorMap, i) }} />
                  {r.key}
                </span>
              </TableCell>
              <TableCell className="text-right">{r.users.toLocaleString()}</TableCell>
              <TableCell className="text-right">{total ? ((r.users / total) * 100).toFixed(1) : "0.0"}%</TableCell>
              <TableCell className="text-right">{r.sessions.toLocaleString()}</TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </ChartCard>
  );
}

void PALETTE_LIST;
