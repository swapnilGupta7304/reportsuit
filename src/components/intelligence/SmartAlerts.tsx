import { motion, AnimatePresence } from "framer-motion";
import type { Alert } from "@/lib/intelligence";

const sev: Record<Alert["severity"], { ring: string; pill: string; label: string }> = {
  critical: { ring: "border-rose-300/60 bg-rose-50/60 dark:bg-rose-500/5",
    pill: "bg-rose-600 text-white", label: "Critical" },
  warning: { ring: "border-amber-300/60 bg-amber-50/60 dark:bg-amber-500/5",
    pill: "bg-amber-500 text-white", label: "Warning" },
  success: { ring: "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-500/5",
    pill: "bg-emerald-600 text-white", label: "Opportunity" },
  info: { ring: "border-indigo-300/60 bg-indigo-50/60 dark:bg-indigo-500/5",
    pill: "bg-indigo-600 text-white", label: "Info" },
};

export function SmartAlerts({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-card">
        No alerts in the selected period — performance is stable.
      </div>
    );
  }
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <AnimatePresence>
        {alerts.map((a, i) => {
          const s = sev[a.severity];
          return (
            <motion.div
              key={a.title + i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-2xl border ${s.ring} p-4 flex gap-3`}
            >
              <div className="text-2xl leading-none">{a.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${s.pill}`}>
                    {s.label}
                  </span>
                  <span className="font-semibold text-sm">{a.title}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{a.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
