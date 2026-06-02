import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useDateRange } from "@/hooks/use-date-range";
import { ModuleHeader } from "@/components/ModuleHeader";
import { NoProjectGate } from "@/components/NoProject";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { IntelligencePanel } from "@/components/intelligence/IntelligencePanel";
import { FileText as FileIcon, Database, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({ component: () => <NoProjectGate><Inner /></NoProjectGate> });

function toCSV(rows: any[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map(r => keys.map(k => esc(r[k])).join(","))].join("\n");
}
function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function Inner() {
  const { currentProject } = useCurrentProject();
  const { range } = useDateRange();
  const from = format(range.from, "yyyy-MM-dd"), to = format(range.to, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["reports", currentProject!.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("analytics_snapshots").select("*")
        .eq("project_id", currentProject!.id)
        .gte("snapshot_date", from).lte("snapshot_date", to)
        .order("snapshot_date", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const exportTable = async (table: "website_metrics" | "traffic_sources" | "top_pages" | "devices" | "geography" | "events" | "app_metrics") => {
    const dateCol = table === "app_metrics" ? "metric_date" : "metric_date";
    const { data, error } = await supabase.from(table).select("*")
      .eq("project_id", currentProject!.id).gte(dateCol, from).lte(dateCol, to);
    if (error) { toast.error(error.message); return; }
    if (!data?.length) { toast.info("No data in selected range"); return; }
    download(`${table}_${from}_${to}.csv`, toCSV(data));
  };

  return (
    <div className="space-y-6">
      <ModuleHeader title="Reports" subtitle="Export persisted analytics" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(["website_metrics", "traffic_sources", "top_pages", "devices", "geography", "events", "app_metrics"] as const).map(t => (
          <div key={t} className="rounded-2xl border bg-card p-5 shadow-card flex items-center justify-between">
            <div><div className="font-display font-semibold capitalize">{t.replace("_", " ")}</div><div className="text-xs text-muted-foreground">CSV export · current range</div></div>
            <Button size="sm" variant="outline" onClick={() => exportTable(t)}><Download className="size-4 mr-1.5" />CSV</Button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        <div className="p-4 border-b"><h3 className="font-display font-semibold">Snapshot history</h3><p className="text-xs text-muted-foreground">Daily sync records stored in Lovable Cloud.</p></div>
        {isLoading ? <Skeleton className="h-40 m-4" /> : !data?.length ? (
          <div className="p-6"><EmptyState icon={FileText} title="No snapshots yet" description="Snapshots accumulate as integrations sync daily." /></div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Captured at</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}><TableCell>{r.snapshot_date}</TableCell><TableCell className="capitalize">{r.source}</TableCell><TableCell className="text-muted-foreground text-xs">{format(new Date(r.created_at), "PPpp")}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <IntelligencePanel
        cards={[
          { icon: Database, accent: "#ff6b00", label: "Snapshots in range", headline: (data?.length ?? 0).toLocaleString(), detail: `From ${from} to ${to}.`, recommendation: (data?.length ?? 0) === 0 ? "Trigger a sync from Settings to populate snapshots." : "Schedule weekly exports for stakeholders." },
          { icon: Calendar, accent: "#3b82f6", label: "Coverage", headline: data?.length ? `${new Set(data.map((r) => r.snapshot_date)).size} days` : "—", detail: "Distinct snapshot days available for export.", recommendation: "Ensure daily sync stays healthy." },
          { icon: FileIcon, accent: "#22c55e", label: "Exportable tables", headline: "7", detail: "Website, traffic, pages, devices, geo, events, app.", recommendation: "Bundle CSVs for monthly executive packs." },
        ]}
      />
    </div>
  );
}
