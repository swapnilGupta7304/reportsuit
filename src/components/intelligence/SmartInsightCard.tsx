import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  headline: string;
  detail: string;
  pct?: number;
  recommendation?: string;
  accent?: string;       // hex tint
  delay?: number;
}

export function SmartInsightCard({
  icon: Icon, label, headline, detail, pct, recommendation, accent = "#ff6b00", delay = 0,
}: Props) {
  const up = (pct ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -3 }}
      className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-card hover:shadow-lg transition-shadow"
    >
      <div
        className="absolute -top-12 -right-12 size-28 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="size-8 rounded-lg grid place-items-center text-white"
              style={{ background: accent }}
            >
              <Icon className="size-4" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
          </div>
          {pct !== undefined && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                up ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15"
                   : "bg-rose-100 text-rose-700 dark:bg-rose-500/15"
              }`}
            >
              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(pct).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="font-display font-semibold text-lg leading-tight">{headline}</div>
        <p className="text-sm text-muted-foreground mt-1.5">{detail}</p>
        {recommendation && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Recommendation: </span>
            {recommendation}
          </div>
        )}
      </div>
    </motion.div>
  );
}
