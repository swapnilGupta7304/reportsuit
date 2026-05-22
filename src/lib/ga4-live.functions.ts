import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ga4RunReportSingle } from "./ga4.server";

const Input = z.object({
  projectId: z.string().uuid(),
  dimensions: z.array(z.string().min(1).max(64)).max(8),
  metrics: z.array(z.string().min(1).max(64)).min(1).max(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  orderByMetric: z.string().min(1).max(64).optional(),
  limit: z.number().int().min(1).max(100000).optional(),
});

export type Ga4AggregateResult = {
  timezone: string | null;
  dimensionHeaders: { name: string }[];
  metricHeaders: { name: string; type?: string }[];
  rows: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  totals: { metricValues: { value: string }[] }[];
  rowCount: number;
};

/**
 * Live GA4 aggregate query. Runs a runReport with NO date dimension so totals
 * equal GA4 UI numbers exactly for the user's selected date range. Use
 * `totals` for KPI numbers — never sum daily rows.
 */
export const ga4Aggregate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<Ga4AggregateResult> => {
    const { supabase } = context;
    const { data: prop, error } = await supabase
      .from("ga4_properties")
      .select("integration_id, property_id, timezone")
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop) {
      return { timezone: null, dimensionHeaders: [], metricHeaders: [], rows: [], totals: [], rowCount: 0 };
    }

    const body: Record<string, any> = {
      dateRanges: [{ startDate: data.startDate, endDate: data.endDate }],
      dimensions: data.dimensions.map((name) => ({ name })),
      metrics: data.metrics.map((name) => ({ name })),
      metricAggregations: ["TOTAL"],
    };
    if (data.orderByMetric) {
      body.orderBys = [{ metric: { metricName: data.orderByMetric }, desc: true }];
    }
    if (data.limit) body.limit = data.limit;

    const r = await ga4RunReportSingle(prop.integration_id as string, prop.property_id as string, body);
    return {
      timezone: (prop.timezone as string) ?? null,
      dimensionHeaders: r.dimensionHeaders,
      metricHeaders: r.metricHeaders,
      rows: r.rows,
      totals: r.totals,
      rowCount: r.rowCount,
    };
  });
