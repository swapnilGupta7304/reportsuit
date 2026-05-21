import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plug, Globe, MapPin } from "lucide-react";
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
import { ChartCard, GradientKpi } from "@/components/ChartCard";
import { PALETTE, PALETTE_LIST, TOOLTIP_STYLE } from "@/lib/chart-palette";

export const Route = createFileRoute("/_authenticated/geography")({
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
    queryKey: ["geo", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geography")
        .select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = data ?? [];
  const byCountry = agg(rows, (r) => r.country ?? "Unknown");
  const byCity = agg(rows, (r) => (r.city ?? "Unknown") + " · " + (r.country ?? ""));

  const totalUsers = byCountry.reduce((s, r) => s + r.users, 0);
  const totalSessions = byCountry.reduce((s, r) => s + r.sessions, 0);
  const topCountry = byCountry[0];

  return (
    <div className="space-y-6">
      <ModuleHeader title="Geography" subtitle="Where your audience is from" />
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No geography data"
          description="Connect GA4 to view country/city breakdown."
          actionLabel="Connect GA4"
          onAction={() => nav({ to: "/settings" })}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GradientKpi label="Countries" value={byCountry.length} from={PALETTE.blue} to={PALETTE.cyan} delay={0} />
            <GradientKpi label="Cities" value={byCity.length} from={PALETTE.purple} to={PALETTE.pink} delay={0.05} />
            <GradientKpi label="Total Users" value={totalUsers.toLocaleString()} from={PALETTE.orange} to={PALETTE.yellow} delay={0.1} />
            <GradientKpi
              label="Top Country"
              value={topCountry?.key ?? "—"}
              hint={topCountry ? `${topCountry.users.toLocaleString()} users` : ""}
              from={PALETTE.green}
              to={PALETTE.teal}
              delay={0.15}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <ChartCard
              title="Top countries"
              subtitle="By active users"
              className="lg:col-span-2"
              delay={0.1}
            >
              <ResponsiveContainer width="100%" height={Math.max(280, Math.min(byCountry.length, 12) * 30)}>
                <BarChart data={byCountry.slice(0, 12)} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <defs>
                    <linearGradient id="geo-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={PALETTE.orange} />
                      <stop offset="50%" stopColor={PALETTE.pink} />
                      <stop offset="100%" stopColor={PALETTE.purple} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="key" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                  <Bar dataKey="users" fill="url(#geo-grad)" radius={[0, 8, 8, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Country share" subtitle="Top 6 countries" delay={0.15}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byCountry.slice(0, 6)}
                    dataKey="users"
                    nameKey="key"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    animationDuration={900}
                  >
                    {byCountry.slice(0, 6).map((_, i) => (
                      <Cell
                        key={i}
                        fill={PALETTE_LIST[i % PALETTE_LIST.length]}
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

          <ChartCard title="Top cities" subtitle="Animated city ranking" delay={0.2}>
            <div className="space-y-2">
              {byCity.slice(0, 15).map((c, i) => {
                const max = byCity[0]?.users || 1;
                const pct = (c.users / max) * 100;
                const color = PALETTE_LIST[i % PALETTE_LIST.length];
                return (
                  <motion.div
                    key={c.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * i, duration: 0.3 }}
                    className="flex items-center gap-3 text-sm"
                  >
                    <MapPin className="size-4 text-muted-foreground shrink-0" />
                    <span className="w-56 truncate">{c.key}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.05 * i + 0.1, duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${color}, ${PALETTE_LIST[(i + 1) % PALETTE_LIST.length]})`,
                        }}
                      />
                    </div>
                    <span className="w-20 text-right tabular-nums font-medium">
                      {c.users.toLocaleString()}
                    </span>
                    <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                      {(c.eng / Math.max(1, c.n)).toFixed(0)}%
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

function agg(rows: any[], keyFn: (r: any) => string) {
  const m = new Map<string, { key: string; users: number; sessions: number; eng: number; n: number }>();
  for (const r of rows) {
    const k = keyFn(r);
    const e = m.get(k) ?? { key: k, users: 0, sessions: 0, eng: 0, n: 0 };
    e.users += r.users ?? 0;
    e.sessions += r.sessions ?? 0;
    e.eng += Number(r.engagement_rate ?? 0);
    e.n += 1;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.users - a.users);
}

void Globe;
