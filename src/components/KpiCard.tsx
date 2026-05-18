import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  delta?: number;
  icon?: LucideIcon;
  hint?: string;
}

export function KpiCard({ label, value, delta, icon: Icon, hint }: Props) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        {Icon && <div className="size-8 rounded-lg bg-primary-soft text-primary grid place-items-center"><Icon className="size-4" /></div>}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
            up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
