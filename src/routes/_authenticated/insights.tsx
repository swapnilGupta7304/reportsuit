import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sparkles, TrendingUp, TrendingDown, Globe, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/insights")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();

  const { data, isLoading } = useQuery({
    queryKey: ["insights", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const from = format(range.from, "yyyy-MM-dd"), to = format(range.to, "yyyy-MM-dd");
      const [w, a, ts] = await Promise.all([
        supabase.from("website_metrics").select("*").eq("project_id", currentProject!.id).gte("metric_date", from).lte("metric_date", to),
        supabase.from("app_metrics").select("*").eq("project_id", currentProject!.id).gte("metric_date", from).lte("metric_date", to),
        supabase.from("traffic_sources").select("source, sessions").eq("project_id", currentProject!.id).gte("metric_date", from).lte("metric_date", to),
      ]);
      return { w: w.data ?? [], a: a.data ?? [], ts: ts.data ?? [] };
    },
  });

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  const w = data?.w ?? [], a = data?.a ?? [], ts = data?.ts ?? [];
  const totalUsers = w.reduce((s, r) => s + (r.total_users ?? 0), 0);
  const totalInstalls = a.reduce((s, r) => s + (r.installs ?? 0), 0);
  const topChan = aggMax(ts, "source", "sessions");

  const insights: { tone: "up" | "down" | "info"; title: string; body: string }[] = [];
  if (totalUsers > 0) insights.push({ tone: "up", title: `${totalUsers.toLocaleString()} total website users`, body: "Sustained user activity across the selected period." });
  if (totalInstalls > 0) insights.push({ tone: "up", title: `${totalInstalls.toLocaleString()} app installs`, body: "Mobile growth is contributing meaningfully to overall reach." });
  if (topChan) insights.push({ tone: "info", title: `${topChan.key} drives the most sessions`, body: `Channel accounts for ${topChan.value.toLocaleString()} sessions in the selected range.` });
  if (insights.length === 0) insights.push({ tone: "info", title: "Awaiting synced data", body: "Connect GA4, Firebase or Play Console to unlock executive insights." });

  return (
    <div className="space-y-6">
      <ModuleHeader title="Executive Insights" subtitle="Automated highlights" />
      <div className="grid lg:grid-cols-2 gap-4">
        {insights.map((i, idx) => {
          const Icon = i.tone === "up" ? TrendingUp : i.tone === "down" ? TrendingDown : Sparkles;
          return (
            <div key={idx} className="rounded-2xl border bg-card p-6 shadow-card flex gap-4">
              <div className="size-10 rounded-xl bg-primary-soft text-primary grid place-items-center shrink-0"><Icon className="size-5" /></div>
              <div><div className="font-display font-semibold">{i.title}</div><p className="text-sm text-muted-foreground mt-1">{i.body}</p></div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Stat icon={Globe} label="Web users" value={totalUsers.toLocaleString()} />
        <Stat icon={Smartphone} label="App installs" value={totalInstalls.toLocaleString()} />
      </div>
    </div>
  );
}
function aggMax(rows: any[], k: string, v: string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r[k] ?? "Unassigned", (m.get(r[k] ?? "Unassigned") ?? 0) + (r[v] ?? 0));
  let top: { key: string; value: number } | null = null;
  for (const [key, value] of m) if (!top || value > top.value) top = { key, value };
  return top;
}
function Stat({ icon: I, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-5 shadow-card flex items-center gap-4"><div className="size-10 rounded-xl bg-primary-soft text-primary grid place-items-center"><I className="size-5" /></div><div><div className="text-xs text-muted-foreground">{label}</div><div className="font-display text-2xl font-semibold">{value}</div></div></div>;
}
