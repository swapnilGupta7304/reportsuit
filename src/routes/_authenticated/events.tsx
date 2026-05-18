import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plug } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/events")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["ev", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error; return data ?? [];
    },
  });
  const rows = data ?? [];
  const m = new Map<string, { event_name: string; event_count: number; users: number }>();
  for (const r of rows) {
    const e = m.get(r.event_name) ?? { event_name: r.event_name, event_count: 0, users: 0 };
    e.event_count += r.event_count ?? 0; e.users += r.users ?? 0; m.set(r.event_name, e);
  }
  const agg = [...m.values()].sort((a, b) => b.event_count - a.event_count);
  const chart = agg.slice(0, 10);

  return (
    <div className="space-y-6">
      <ModuleHeader title="Top Events" />
      {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : agg.length === 0 ? (
        <EmptyState icon={Plug} title="No event data" description="Connect GA4 to view event analytics." actionLabel="Connect GA4" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <>
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <h3 className="font-display font-semibold mb-4">Top 10 events</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="event_name" type="category" width={140} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Bar dataKey="event_count" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Event</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Users</TableHead></TableRow></TableHeader>
              <TableBody>{agg.map(r => <TableRow key={r.event_name}><TableCell className="font-mono text-xs">{r.event_name}</TableCell><TableCell className="text-right">{r.event_count.toLocaleString()}</TableCell><TableCell className="text-right">{r.users.toLocaleString()}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
