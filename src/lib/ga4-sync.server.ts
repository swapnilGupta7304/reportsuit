import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ga4RunReport } from "./ga4.server";

const DATE_RANGE = { startDate: "30daysAgo", endDate: "yesterday" };

function fmt(d: string) { return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`; }
const N = (v: any) => Number(v ?? 0);

async function clearRange(table: string, projectId: string) {
  const start = new Date(); start.setDate(start.getDate() - 35);
  await supabaseAdmin.from(table as any).delete()
    .eq("project_id", projectId)
    .gte("metric_date", start.toISOString().slice(0, 10));
}

export async function syncProjectGA4(projectId: string) {
  const { data: prop, error } = await supabaseAdmin.from("ga4_properties")
    .select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!prop) throw new Error("No GA4 property linked to this project");
  const integrationId = prop.integration_id;
  const propertyId = prop.property_id;

  // website_metrics
  const wm = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "totalUsers" }, { name: "activeUsers" }, { name: "newUsers" },
      { name: "sessions" }, { name: "bounceRate" }, { name: "engagementRate" },
      { name: "averageSessionDuration" }, { name: "eventCount" },
    ],
  });
  const wmRows = (wm.rows ?? []).map((r: any) => ({
    project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
    total_users: N(r.metricValues[0].value), active_users: N(r.metricValues[1].value),
    new_users: N(r.metricValues[2].value),
    returning_users: Math.max(0, N(r.metricValues[1].value) - N(r.metricValues[2].value)),
    sessions: N(r.metricValues[3].value), bounce_rate: N(r.metricValues[4].value),
    engagement_rate: N(r.metricValues[5].value), avg_engagement_time: N(r.metricValues[6].value),
    event_count: N(r.metricValues[7].value), organic_traffic: 0,
  }));
  await clearRange("website_metrics", projectId);
  if (wmRows.length) await supabaseAdmin.from("website_metrics").insert(wmRows);

  // traffic_sources
  const ts = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "sessions" }, { name: "engagedSessions" }, { name: "engagementRate" },
      { name: "averageSessionDuration" }, { name: "bounceRate" },
      { name: "eventsPerSession" }, { name: "eventCount" },
    ],
  });
  const tsRows = (ts.rows ?? []).map((r: any) => ({
    project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
    source: r.dimensionValues[1].value || "Unassigned",
    sessions: N(r.metricValues[0].value), engaged_sessions: N(r.metricValues[1].value),
    engagement_rate: N(r.metricValues[2].value),
    avg_engagement_time_per_session: N(r.metricValues[3].value),
    bounce_rate: N(r.metricValues[4].value), events_per_session: N(r.metricValues[5].value),
    event_count: N(r.metricValues[6].value),
  }));
  await clearRange("traffic_sources", projectId);
  if (tsRows.length) await supabaseAdmin.from("traffic_sources").insert(tsRows);

  // top_pages
  const tp = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "pagePath" }],
    metrics: [
      { name: "screenPageViews" }, { name: "totalUsers" }, { name: "activeUsers" },
      { name: "newUsers" }, { name: "sessions" }, { name: "bounceRate" },
      { name: "engagementRate" }, { name: "averageSessionDuration" },
    ],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 500,
  });
  const tpRows = (tp.rows ?? []).map((r: any) => ({
    project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
    page_path: r.dimensionValues[1].value,
    pageviews: N(r.metricValues[0].value), total_users: N(r.metricValues[1].value),
    active_users: N(r.metricValues[2].value), new_users: N(r.metricValues[3].value),
    returning_users: Math.max(0, N(r.metricValues[2].value) - N(r.metricValues[3].value)),
    sessions: N(r.metricValues[4].value), bounce_rate: N(r.metricValues[5].value),
    engagement_rate: N(r.metricValues[6].value), avg_engagement_time: N(r.metricValues[7].value),
  }));
  await clearRange("top_pages", projectId);
  if (tpRows.length) await supabaseAdmin.from("top_pages").insert(tpRows);

  // devices
  const dv = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "deviceCategory" }, { name: "operatingSystem" }],
    metrics: [
      { name: "activeUsers" }, { name: "newUsers" }, { name: "engagedSessions" },
      { name: "bounceRate" }, { name: "averageSessionDuration" },
      { name: "engagementRate" }, { name: "eventCount" },
    ],
  });
  const dvRows = (dv.rows ?? []).map((r: any) => ({
    project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
    device_category: r.dimensionValues[1].value, operating_system: r.dimensionValues[2].value,
    active_users: N(r.metricValues[0].value), new_users: N(r.metricValues[1].value),
    engaged_sessions: N(r.metricValues[2].value), bounce_rate: N(r.metricValues[3].value),
    avg_engagement_time: N(r.metricValues[4].value),
    engagement_rate: N(r.metricValues[5].value), event_count: N(r.metricValues[6].value),
  }));
  await clearRange("devices", projectId);
  if (dvRows.length) await supabaseAdmin.from("devices").insert(dvRows);

  // geography
  const gg = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "country" }, { name: "countryId" }, { name: "city" }],
    metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "engagementRate" }],
    limit: 1000,
  });
  const ggRows = (gg.rows ?? []).map((r: any) => ({
    project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
    country: r.dimensionValues[1].value, country_code: r.dimensionValues[2].value,
    city: r.dimensionValues[3].value,
    users: N(r.metricValues[0].value), sessions: N(r.metricValues[1].value),
    engagement_rate: N(r.metricValues[2].value),
  }));
  await clearRange("geography", projectId);
  if (ggRows.length) await supabaseAdmin.from("geography").insert(ggRows);

  // events
  const ev = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 500,
  });
  const evRows = (ev.rows ?? []).map((r: any) => ({
    project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
    event_name: r.dimensionValues[1].value,
    event_count: N(r.metricValues[0].value), users: N(r.metricValues[1].value),
  }));
  await clearRange("events", projectId);
  if (evRows.length) await supabaseAdmin.from("events").insert(evRows);

  const totals = {
    website_metrics: wmRows.length, traffic_sources: tsRows.length, top_pages: tpRows.length,
    devices: dvRows.length, geography: ggRows.length, events: evRows.length,
  };

  await supabaseAdmin.from("analytics_snapshots").insert({
    project_id: projectId, source: "ga4" as any,
    snapshot_date: new Date().toISOString().slice(0, 10),
    payload: { totals } as any,
  });
  await supabaseAdmin.from("integrations").update({
    last_synced_at: new Date().toISOString(),
    status: "connected" as any,
  }).eq("id", integrationId);

  return { project_id: projectId, totals };
}
