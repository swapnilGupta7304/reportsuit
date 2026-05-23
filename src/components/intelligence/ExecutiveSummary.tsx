import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { SummaryBullet, Tone } from "@/lib/intelligence";

const iconFor = (t: Tone) =>
  t === "up" || t === "good" ? CheckCircle2 :
  t === "down" || t === "warn" ? AlertTriangle :
  t === "flat" ? Minus : Sparkles;

const toneStyles: Record<Tone, string> = {
  up: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
  good: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
  down: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
  warn: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
  flat: "text-slate-500 bg-slate-100 dark:bg-slate-500/10",
  info: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
};

interface Props {
  bullets: SummaryBullet[];
  title?: string;
}

export function ExecutiveSummary({ bullets, title = "Executive Summary" }: Props) {
  if (!bullets.length) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary-soft/30 p-6 shadow-card"
    >
      <div className="absolute -top-10 -right-10 size-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <div className="size-8 rounded-lg gradient-primary text-primary-foreground grid place-items-center">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg leading-none">{title}</h2>
            <p className="text-xs text-muted-foreground mt-1">Auto-generated intelligence from the selected period</p>
          </div>
        </div>
        <ul className="grid md:grid-cols-2 gap-2.5">
          {bullets.map((b, i) => {
            const Icon = iconFor(b.tone);
            const Arrow = b.pct !== undefined && b.pct > 0 ? TrendingUp :
              b.pct !== undefined && b.pct < 0 ? TrendingDown : null;
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 rounded-xl border bg-card/60 backdrop-blur px-3.5 py-2.5"
              >
                <span className={`size-7 rounded-lg grid place-items-center shrink-0 ${toneStyles[b.tone]}`}>
                  <Icon className="size-3.5" />
                </span>
                <div className="flex-1 text-sm">
                  <span>{b.text}</span>
                  {Arrow && (
                    <Arrow className={`inline size-3.5 ml-1 -mt-0.5 ${b.pct! > 0 ? "text-emerald-600" : "text-rose-600"}`} />
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.section>
  );
}
