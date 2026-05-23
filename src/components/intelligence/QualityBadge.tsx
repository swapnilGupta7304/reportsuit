import type { QualityScore } from "@/lib/intelligence";

export function QualityBadge({ q, compact = false }: { q: QualityScore; compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: q.color }}
      title={`Score: ${q.score}/100`}
    >
      <span className="size-1.5 rounded-full bg-white/90" />
      {compact ? q.label : `${q.label} · ${q.score}`}
    </span>
  );
}
