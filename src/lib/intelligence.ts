// Executive Intelligence layer — pure utilities for scoring, comparison
// and narrative generation. No I/O. Consumes GA4 numbers already on hand.

export type Tone = "up" | "down" | "flat" | "info" | "warn" | "good";
export type Severity = "info" | "success" | "warning" | "critical";

export interface Delta {
  curr: number;
  prev: number;
  abs: number;
  pct: number;       // signed, %
  tone: Tone;        // up / down / flat
  improved: boolean; // direction-aware (e.g. lower bounce = improved)
}

export function compare(curr: number, prev: number, lowerIsBetter = false): Delta {
  const abs = curr - prev;
  const pct = prev > 0 ? (abs / prev) * 100 : curr > 0 ? 100 : 0;
  const tone: Tone = Math.abs(pct) < 0.5 ? "flat" : abs > 0 ? "up" : "down";
  const improved = lowerIsBetter ? abs < 0 : abs > 0;
  return { curr, prev, abs, pct, tone, improved };
}

export function fmtPct(n: number, digits = 1) {
  const v = Number.isFinite(n) ? n : 0;
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

// ── Traffic Quality Index ─────────────────────────────────────────────
// Inputs are already in 0-100 (rates as %) and absolute units.
export interface QualityInputs {
  engagementRate: number;  // %
  bounceRate: number;      // %
  avgEngagementSec: number;
  eventsPerSession: number;
}

export interface QualityScore {
  score: number;                              // 0-100
  label: "Excellent" | "Good" | "Moderate" | "Weak";
  color: string;                              // hex for badges
}

export function qualityScore(i: QualityInputs): QualityScore {
  const eng = clamp(i.engagementRate, 0, 100);
  const bounceInv = 100 - clamp(i.bounceRate, 0, 100);
  const dur = clamp((i.avgEngagementSec / 120) * 100, 0, 100); // 2min = 100
  const eps = clamp((i.eventsPerSession / 10) * 100, 0, 100);  // 10ev = 100
  const score = Math.round(eng * 0.4 + bounceInv * 0.25 + dur * 0.2 + eps * 0.15);
  const { label, color } = scoreBand(score);
  return { score, label, color };
}

export function scoreBand(score: number): { label: QualityScore["label"]; color: string } {
  if (score >= 75) return { label: "Excellent", color: "#22c55e" };
  if (score >= 55) return { label: "Good", color: "#3b82f6" };
  if (score >= 35) return { label: "Moderate", color: "#f59e0b" };
  return { label: "Weak", color: "#ef4444" };
}

// ── Content Health Score ──────────────────────────────────────────────
export interface ContentInputs {
  bounceRate: number;
  viewsPerActiveUser: number;
  activeUsers: number;
  topActiveUsers: number; // max in dataset, for normalization
}

export function contentHealth(c: ContentInputs): QualityScore {
  const bounceInv = 100 - clamp(c.bounceRate, 0, 100);
  const vpu = clamp((c.viewsPerActiveUser / 4) * 100, 0, 100); // 4 views = 100
  const reach = c.topActiveUsers > 0 ? clamp((c.activeUsers / c.topActiveUsers) * 100, 0, 100) : 0;
  const score = Math.round(bounceInv * 0.45 + vpu * 0.3 + reach * 0.25);
  const { label, color } = scoreBand(score);
  return { score, label, color };
}

// ── SEO Opportunity Score ─────────────────────────────────────────────
// Pages with low traffic share but strong engagement & low bounce =
// the best SEO investment targets.
export function seoOpportunity(c: {
  bounceRate: number;
  viewsPerActiveUser: number;
  activeUsersShare: number; // 0..1
}): QualityScore {
  const bounceInv = 100 - clamp(c.bounceRate, 0, 100);
  const vpu = clamp((c.viewsPerActiveUser / 4) * 100, 0, 100);
  const headroom = (1 - clamp(c.activeUsersShare, 0, 1)) * 100; // less traffic now = more upside
  const score = Math.round(bounceInv * 0.4 + vpu * 0.3 + headroom * 0.3);
  const { label, color } = scoreBand(score);
  return { score, label, color };
}

// ── Executive summary bullets ────────────────────────────────────────
export interface SummaryInputs {
  totalUsers: Delta;
  sessions: Delta;
  newUsers: Delta;
  engagementRate: Delta;   // %
  bounceRate: Delta;       // % (lower better)
  topChannel?: { name: string; share: number };       // share 0..1
  topCountry?: { name: string; sessions: number };
  topDevice?: { name: string; share: number };
}

export interface SummaryBullet {
  tone: Tone;
  text: string;
  pct?: number;
}

export function executiveSummary(i: SummaryInputs): SummaryBullet[] {
  const out: SummaryBullet[] = [];

  push(out, i.totalUsers, (d) =>
    `Total users ${verb(d)} ${fmtPct(d.pct)} vs previous period (${fmt(d.curr)} users)`
  );
  push(out, i.sessions, (d) =>
    `Sessions ${verb(d)} ${fmtPct(d.pct)} (${fmt(d.curr)} sessions)`
  );
  push(out, i.newUsers, (d) =>
    `New user acquisition is ${trend(d)} at ${fmtPct(d.pct)}`
  );
  push(out, i.engagementRate, (d) =>
    `Engagement rate ${verb(d)} to ${d.curr.toFixed(1)}% (${fmtPct(d.pct)})`
  );
  // Bounce rate: lower is better — invert tone for readability
  if (i.bounceRate.prev > 0) {
    const better = i.bounceRate.curr < i.bounceRate.prev;
    out.push({
      tone: better ? "good" : "warn",
      text: `Bounce rate ${better ? "improved" : "worsened"} to ${i.bounceRate.curr.toFixed(1)}% (${fmtPct(i.bounceRate.pct)})`,
      pct: i.bounceRate.pct,
    });
  }
  if (i.topChannel) {
    out.push({
      tone: "info",
      text: `${i.topChannel.name} drives ${(i.topChannel.share * 100).toFixed(0)}% of all sessions — your strongest acquisition channel`,
    });
  }
  if (i.topCountry) {
    out.push({
      tone: "info",
      text: `${i.topCountry.name} leads geographically with ${fmt(i.topCountry.sessions)} sessions`,
    });
  }
  if (i.topDevice) {
    out.push({
      tone: "info",
      text: `${cap(i.topDevice.name)} contributes ${(i.topDevice.share * 100).toFixed(0)}% of total traffic`,
    });
  }
  return out;
}

// ── Smart Alerts ─────────────────────────────────────────────────────
export interface Alert {
  severity: Severity;
  icon: string;     // emoji
  title: string;
  detail: string;
}

export function buildAlerts(i: SummaryInputs & {
  channels?: { name: string; sessions: Delta }[];
}): Alert[] {
  const alerts: Alert[] = [];

  if (i.bounceRate.prev > 0 && i.bounceRate.pct > 10) {
    alerts.push({
      severity: "critical",
      icon: "🚨",
      title: `Bounce rate up ${fmtPct(i.bounceRate.pct, 0)}`,
      detail: "Inspect recent landing pages and campaigns — visitors are leaving faster.",
    });
  }
  if (i.totalUsers.pct > 15) {
    alerts.push({
      severity: "success",
      icon: "🚀",
      title: `User growth surging ${fmtPct(i.totalUsers.pct, 0)}`,
      detail: "Audience expansion outpacing baseline — double down on the top channel.",
    });
  }
  if (i.totalUsers.pct < -10) {
    alerts.push({
      severity: "warning",
      icon: "📉",
      title: `User decline ${fmtPct(i.totalUsers.pct, 0)}`,
      detail: "Investigate seasonality, content cadence, and paid campaign status.",
    });
  }
  if (i.engagementRate.pct > 5) {
    alerts.push({
      severity: "success",
      icon: "🔥",
      title: "Engagement quality improving",
      detail: `Engagement rate climbed to ${i.engagementRate.curr.toFixed(1)}% — content is resonating.`,
    });
  }
  if (i.engagementRate.pct < -5) {
    alerts.push({
      severity: "warning",
      icon: "⚠",
      title: "Engagement softening",
      detail: `Engagement rate dropped to ${i.engagementRate.curr.toFixed(1)}%. Review content freshness.`,
    });
  }
  for (const c of i.channels ?? []) {
    if (c.sessions.prev > 100 && c.sessions.pct < -25) {
      alerts.push({
        severity: "warning",
        icon: "⚠",
        title: `${c.name} traffic declining`,
        detail: `Sessions down ${fmtPct(c.sessions.pct, 0)} — check tracking, links, or campaign status.`,
      });
    }
    if (c.sessions.prev > 100 && c.sessions.pct > 35) {
      alerts.push({
        severity: "success",
        icon: "🌟",
        title: `${c.name} accelerating`,
        detail: `Sessions up ${fmtPct(c.sessions.pct, 0)} — capitalize on this momentum.`,
      });
    }
  }
  return alerts;
}

// ── helpers ──────────────────────────────────────────────────────────
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));
}
function fmt(n: number) {
  return Math.round(n).toLocaleString();
}
function verb(d: Delta) {
  if (d.tone === "up") return "increased";
  if (d.tone === "down") return "decreased";
  return "held steady";
}
function trend(d: Delta) {
  if (d.tone === "up") return "growing";
  if (d.tone === "down") return "slowing";
  return "stable";
}
function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function push(out: SummaryBullet[], d: Delta, f: (d: Delta) => string) {
  if (d.curr === 0 && d.prev === 0) return;
  out.push({
    tone: d.tone === "flat" ? "info" : d.improved ? "good" : d.tone === "down" ? "warn" : d.tone,
    text: f(d),
    pct: d.pct,
  });
}
