import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Activity, UserPlus, Repeat, MousePointer, TrendingUp, Smartphone, FolderKanban, Plug } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { KpiCard } from "@/components/KpiCard";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";

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

  const totals = (metrics ?? []).reduce(
    (a, m) => ({
      users: a.users + (m.total_users ?? 0),
      active: a.active + (m.active_users ?? 0),
      newU: a.newU + (m.new_users ?? 0),
      ret: a.ret + (m.returning_users ?? 0),
      sessions: a.sessions + (m.sessions ?? 0),
      events: a.events + (m.event_count ?? 0),
      organic: a.organic + (m.organic_traffic ?? 0),
    }),
    { users: 0, active: 0, newU: 0, ret: 0, sessions: 0, events: 0, organic: 0 }
  );
  const hasData = (metrics?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Executive Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {currentProject?.name} · {format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Users" value={totals.users.toLocaleString()} icon={Users} />
        <KpiCard label="Active Users" value={totals.active.toLocaleString()} icon={Activity} />
        <KpiCard label="New Users" value={totals.newU.toLocaleString()} icon={UserPlus} />
        <KpiCard label="Returning" value={totals.ret.toLocaleString()} icon={Repeat} />
        <KpiCard label="Sessions" value={totals.sessions.toLocaleString()} icon={TrendingUp} />
        <KpiCard label="Events" value={totals.events.toLocaleString()} icon={MousePointer} />
        <KpiCard label="Organic Traffic" value={totals.organic.toLocaleString()} icon={TrendingUp} />
        <KpiCard label="Connected Projects" value={projects.length} icon={Smartphone} />
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">User Trend</h2>
            <p className="text-xs text-muted-foreground">Daily users for selected range</p>
          </div>
        </div>
        {hasData ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="metric_date" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="total_users" stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
    </div>
  );
}
