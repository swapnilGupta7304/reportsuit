import { Award, type LucideIcon } from "lucide-react";
import type { SummaryBullet, Alert, QualityScore } from "@/lib/intelligence";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { SmartAlerts } from "./SmartAlerts";
import { SmartInsightCard } from "./SmartInsightCard";
import { QualityBadge } from "./QualityBadge";

export interface InsightCardData {
  icon: LucideIcon;
  label: string;
  headline: string;
  detail: string;
  pct?: number;
  recommendation?: string;
  accent?: string;
}

interface Props {
  title?: string;
  summaryTitle?: string;
  bullets?: SummaryBullet[];
  quality?: { score: QualityScore; topLabel?: string; topValue?: string };
  cards?: InsightCardData[];
  alerts?: Alert[];
  rangeLabel?: string;
}

/**
 * Reusable "Intelligent Insights" block. Place BELOW charts/tables on
 * every analytics module. Any prop can be omitted — only sections with
 * data render.
 */
export function IntelligencePanel({
  title = "Intelligent Insights",
  summaryTitle = "Executive Summary",
  bullets,
  quality,
  cards,
  alerts,
  rangeLabel,
}: Props) {
  const hasAny =
    (bullets && bullets.length > 0) ||
    !!quality ||
    (cards && cards.length > 0) ||
    (alerts && alerts.length > 0);
  if (!hasAny) return null;

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-block h-6 w-1 rounded-full bg-gradient-to-b from-orange-500 via-pink-500 to-purple-500" />
        <h2 className="font-display font-semibold text-lg">{title}</h2>
        {rangeLabel && (
          <span className="ml-auto text-xs text-muted-foreground">{rangeLabel}</span>
        )}
      </div>

      {bullets && bullets.length > 0 && (
        <ExecutiveSummary bullets={bullets} title={summaryTitle} />
      )}

      {quality && (
        <div className="rounded-2xl border bg-gradient-to-br from-card to-primary-soft/20 p-5 shadow-card flex flex-wrap items-center gap-4">
          <div className="size-10 rounded-xl gradient-primary text-primary-foreground grid place-items-center">
            <Award className="size-5" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Traffic Quality Index
            </div>
            <div className="font-display text-2xl font-bold mt-0.5">
              {quality.score.score}
              <span className="text-base font-normal text-muted-foreground"> / 100</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Weighted: engagement, bounce, duration, events/session
            </div>
          </div>
          <QualityBadge q={quality.score} />
          {quality.topLabel && quality.topValue && (
            <>
              <div className="hidden md:block h-10 w-px bg-border" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {quality.topLabel}
                </div>
                <div className="text-sm font-semibold">{quality.topValue}</div>
              </div>
            </>
          )}
        </div>
      )}

      {cards && cards.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <SmartInsightCard
              key={`${c.label}-${i}`}
              icon={c.icon}
              label={c.label}
              headline={c.headline}
              detail={c.detail}
              pct={c.pct}
              recommendation={c.recommendation}
              accent={c.accent}
              delay={i * 0.05}
            />
          ))}
        </div>
      )}

      {alerts && alerts.length > 0 && <SmartAlerts alerts={alerts} />}
    </section>
  );
}

export const ORGANIC_CHANNELS = new Set([
  "Organic Search",
  "Organic Social",
  "Organic Video",
  "Organic Shopping",
]);
