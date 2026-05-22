import type { Ga4AggregateResult } from "./ga4-live.functions";

/**
 * Helper to read a metric column by name from a GA4 row.
 * GA4 returns metrics in the order they were requested; we look up by header name
 * to be safe across re-orderings.
 */
export function metricIndex(res: Ga4AggregateResult, name: string): number {
  return res.metricHeaders.findIndex((h) => h.name === name);
}

export function dimensionIndex(res: Ga4AggregateResult, name: string): number {
  return res.dimensionHeaders.findIndex((h) => h.name === name);
}

export function readMetric(
  res: Ga4AggregateResult,
  row: { metricValues: { value: string }[] },
  name: string,
): number {
  const i = metricIndex(res, name);
  if (i < 0) return 0;
  return Number(row.metricValues[i]?.value ?? 0);
}

export function readDim(
  res: Ga4AggregateResult,
  row: { dimensionValues: { value: string }[] },
  name: string,
): string {
  const i = dimensionIndex(res, name);
  if (i < 0) return "";
  return row.dimensionValues[i]?.value ?? "";
}

export function readTotal(res: Ga4AggregateResult, name: string): number {
  const i = metricIndex(res, name);
  if (i < 0) return 0;
  return Number(res.totals[0]?.metricValues[i]?.value ?? 0);
}
