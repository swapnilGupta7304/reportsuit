import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/geography")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["geo", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("geography").select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error; return data ?? [];
    },
  });
  const rows = data ?? [];
  const byCountry = agg(rows, r => r.country ?? "Unknown");
  const byCity = agg(rows, r => (r.city ?? "Unknown") + " · " + (r.country ?? ""));

  return (
    <div className="space-y-6">
      <ModuleHeader title="Geography" />
      {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : rows.length === 0 ? (
        <EmptyState icon={Plug} title="No geography data" description="Connect GA4 to view country/city breakdown." actionLabel="Connect GA4" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="By Country" rows={byCountry.slice(0, 20)} />
          <Card title="By City" rows={byCity.slice(0, 20)} />
        </div>
      )}
    </div>
  );
}
function agg(rows: any[], keyFn: (r: any) => string) {
  const m = new Map<string, { key: string; users: number; sessions: number; eng: number; n: number }>();
  for (const r of rows) {
    const k = keyFn(r);
    const e = m.get(k) ?? { key: k, users: 0, sessions: 0, eng: 0, n: 0 };
    e.users += r.users ?? 0; e.sessions += r.sessions ?? 0;
    e.eng += Number(r.engagement_rate ?? 0); e.n += 1; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.users - a.users);
}
function Card({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
      <div className="p-4 border-b"><h3 className="font-display font-semibold">{title}</h3></div>
      <Table>
        <TableHeader><TableRow><TableHead>Location</TableHead><TableHead className="text-right">Users</TableHead><TableHead className="text-right">Sessions</TableHead><TableHead className="text-right">Engagement</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.key}><TableCell>{r.key}</TableCell><TableCell className="text-right">{r.users.toLocaleString()}</TableCell><TableCell className="text-right">{r.sessions.toLocaleString()}</TableCell><TableCell className="text-right">{(r.eng / r.n).toFixed(1)}%</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
