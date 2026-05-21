import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ChartCard({ title, subtitle, right, children, className, delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "rounded-2xl border bg-card p-6 shadow-card hover:shadow-lg transition-shadow",
        className,
      )}
    >
      <div className="flex items-start justify-between mb-4 gap-2">
        <div>
          <h3 className="font-display font-semibold text-base">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </motion.div>
  );
}

interface GradientKpiProps {
  label: string;
  value: string | number;
  hint?: string;
  from: string;
  to: string;
  delay?: number;
}

export function GradientKpi({ label, value, hint, from, to, delay = 0 }: GradientKpiProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -left-6 -bottom-10 size-28 rounded-full bg-black/10 blur-2xl" />
      <div className="relative">
        <div className="text-xs font-medium uppercase tracking-wide opacity-90">{label}</div>
        <div className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs opacity-80">{hint}</div>}
      </div>
    </motion.div>
  );
}
