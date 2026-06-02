import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Trash2, Users, Activity, Star, AlertTriangle, Plug, Smartphone } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { KpiCard } from "@/components/KpiCard";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { IntelligencePanel } from "@/components/intelligence/IntelligencePanel";

export const Route = createFileRoute("/_authenticated/app-analytics")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["am", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_metrics").select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"))
        .order("metric_date");
      if (error) throw error; return data ?? [];
    },
  });
  const rows = data ?? [];
  const t = rows.reduce((a, m) => ({
    inst: a.inst + (m.installs ?? 0), org: a.org + (m.organic_installs ?? 0),
    un: a.un + (m.uninstalls ?? 0), dau: a.dau + (m.dau ?? 0), mau: a.mau + (m.mau ?? 0),
    sess: a.sess + (m.sessions ?? 0), rating: a.rating + Number(m.avg_rating ?? 0),
    crash: a.crash + Number(m.crash_rate ?? 0), anr: a.anr + Number(m.anr_rate ?? 0),
    ret: a.ret + Number(m.retention_rate ?? 0), n: a.n + 1,
  }), { inst: 0, org: 0, un: 0, dau: 0, mau: 0, sess: 0, rating: 0, crash: 0, anr: 0, ret: 0, n: 0 });
  const has = rows.length > 0;

  return (
    <div className="space-y-8">
      <ModuleHeader title="App Analytics" subtitle="Firebase + Google Play Console" />
      {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : !has ? (
        <EmptyState icon={Plug} title="No app analytics" description="Connect Firebase Analytics and Google Play Console to start syncing app metrics." actionLabel="Connect integrations" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Installs" value={t.inst.toLocaleString()} icon={Download} />
            <KpiCard label="Organic Installs" value={t.org.toLocaleString()} icon={Download} />
            <KpiCard label="Uninstalls" value={t.un.toLocaleString()} icon={Trash2} />
            <KpiCard label="Sessions" value={t.sess.toLocaleString()} icon={Activity} />
            <KpiCard label="DAU" value={t.dau.toLocaleString()} icon={Users} />
            <KpiCard label="MAU" value={t.mau.toLocaleString()} icon={Users} />
            <KpiCard label="Avg Rating" value={t.n ? (t.rating / t.n).toFixed(2) : "—"} icon={Star} />
            <KpiCard label="Crash Rate" value={t.n ? (t.crash / t.n).toFixed(2) + "%" : "—"} icon={AlertTriangle} />
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <h3 className="font-display font-semibold mb-4">Installs vs Uninstalls</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={rows}>
                <defs>
                  <linearGradient id="ai" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} /><stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="au" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.4} /><stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="metric_date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Legend />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="installs" stroke="var(--color-primary)" fill="url(#ai)" strokeWidth={2} />
                <Area type="monotone" dataKey="uninstalls" stroke="var(--color-destructive)" fill="url(#au)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <IntelligencePanel
            cards={[
              { icon: Download, accent: "#ff6b00", label: "Installs", headline: t.inst.toLocaleString(), detail: `${t.org.toLocaleString()} organic · ${t.un.toLocaleString()} uninstalls.`, recommendation: "Sustain ASO and review velocity to keep organic share growing." },
              { icon: Users, accent: "#3b82f6", label: "Active audience", headline: `${t.dau.toLocaleString()} DAU`, detail: `${t.mau.toLocaleString()} MAU · ${t.mau ? ((t.dau / t.mau) * 100).toFixed(1) : "0"}% stickiness.`, recommendation: "Push engagement loops to lift DAU/MAU ratio." },
              { icon: Star, accent: "#22c55e", label: "Quality signal", headline: t.n ? (t.rating / t.n).toFixed(2) + "★" : "—", detail: `Avg crash ${t.n ? (t.crash / t.n).toFixed(2) : "0"}% · ANR ${t.n ? (t.anr / t.n).toFixed(2) : "0"}%.`, recommendation: t.n && (t.crash / t.n) > 1 ? "Investigate top crash clusters this release." : "Quality stable — keep release cadence." },
              { icon: Activity, accent: "#a855f7", label: "Retention", headline: t.n ? (t.ret / t.n).toFixed(1) + "%" : "—", detail: "Average retention across the selected window.", recommendation: "Run cohort analysis to find retention cliffs." },
            ]}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Smartphone className="size-3" /> {currentProject?.name} · {rows.length} daily snapshots</div>
        </>
      )}
    </div>
  );
}
