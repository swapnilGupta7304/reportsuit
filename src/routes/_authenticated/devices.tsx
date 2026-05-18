import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plug } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/devices")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

const COLORS = ["#ea580c", "#fb923c", "#fdba74", "#fed7aa", "#fff7ed"];

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dev", currentProject!.id, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("*")
        .eq("project_id", currentProject!.id)
        .gte("metric_date", format(range.from, "yyyy-MM-dd"))
        .lte("metric_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error; return data ?? [];
    },
  });
  const rows = data ?? [];
  const byCat = aggBy(rows, "device_category");
  const byOs = aggBy(rows, "operating_system");

  return (
    <div className="space-y-6">
      <ModuleHeader title="Devices" />
      {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : rows.length === 0 ? (
        <EmptyState icon={Plug} title="No device data" description="Connect GA4 to view device breakdown." actionLabel="Connect GA4" onAction={() => nav({ to: "/settings" })} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="Device category">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byCat} dataKey="users" nameKey="key" outerRadius={90} label>
                  {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
            <DeviceTable rows={byCat} label="Category" />
          </Card>
          <Card title="Operating system">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byOs} dataKey="users" nameKey="key" outerRadius={90} label>
                  {byOs.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
            <DeviceTable rows={byOs} label="OS" />
          </Card>
        </div>
      )}
    </div>
  );
}

function aggBy(rows: any[], key: string) {
  const m = new Map<string, { key: string; users: number; sessions: number; bounce: number; n: number }>();
  for (const r of rows) {
    const k = r[key] ?? "Unknown";
    const e = m.get(k) ?? { key: k, users: 0, sessions: 0, bounce: 0, n: 0 };
    e.users += r.active_users ?? 0; e.sessions += r.engaged_sessions ?? 0;
    e.bounce += Number(r.bounce_rate ?? 0); e.n += 1; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.users - a.users);
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-6 shadow-card"><h3 className="font-display font-semibold mb-4">{title}</h3>{children}</div>;
}
function DeviceTable({ rows, label }: { rows: any[]; label: string }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>{label}</TableHead><TableHead className="text-right">Users</TableHead><TableHead className="text-right">Sessions</TableHead><TableHead className="text-right">Bounce</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map(r => (
          <TableRow key={r.key}><TableCell>{r.key}</TableCell><TableCell className="text-right">{r.users.toLocaleString()}</TableCell><TableCell className="text-right">{r.sessions.toLocaleString()}</TableCell><TableCell className="text-right">{(r.bounce / r.n).toFixed(1)}%</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
