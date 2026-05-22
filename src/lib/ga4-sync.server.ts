import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ga4RunReport, ga4GetPropertyMeta } from "./ga4.server";

/**
 * Pull the last 90 days. The dashboard date picker filters within this window.
 * GA4 reports as of "yesterday" — today's data is incomplete.
 */
const DATE_RANGE = { startDate: "90daysAgo", endDate: "yesterday" };
const CLEAR_WINDOW_DAYS = 95;

function fmt(d: string) { return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`; }
const N = (v: any) => Number(v ?? 0);

async function clearRange(table: string, projectId: string) {
  const start = new Date(); start.setDate(start.getDate() - CLEAR_WINDOW_DAYS);
  await supabaseAdmin.from(table as any).delete()
    .eq("project_id", projectId)
    .gte("metric_date", start.toISOString().slice(0, 10));
}

async function insertChunked(table: string, rows: any[]) {
  if (!rows.length) return;
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabaseAdmin.from(table as any).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`Insert ${table} failed: ${error.message}`);
  }
}

export async function syncProjectGA4(projectId: string) {
  const { data: prop, error } = await supabaseAdmin.from("ga4_properties")
    .select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!prop) throw new Error("No GA4 property linked to this project");
  const integrationId = prop.integration_id;
  const propertyId = prop.property_id;

  // Refresh property metadata (timezone, currency)
  try {
    const meta = await ga4GetPropertyMeta(integrationId, propertyId);
    await supabaseAdmin.from("ga4_properties")
      .update({ timezone: meta.timeZone, currency_code: meta.currencyCode })
      .eq("id", prop.id);
  } catch { /* non-fatal */ }

  // ============ website_metrics ============
  // GA4: Reports → Realtime/Acquisition + Engagement (date dimension)
  const wm = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "totalUsers" }, { name: "activeUsers" }, { name: "newUsers" },
      { name: "sessions" }, { name: "bounceRate" }, { name: "engagementRate" },
      { name: "userEngagementDuration" }, { name: "eventCount" },
      { name: "screenPageViews" },
    ],
  });
  const wmRows = wm.rows.map((r: any) => {
    const totalUsers = N(r.metricValues[0].value);
    const activeUsers = N(r.metricValues[1].value);
    const newUsers = N(r.metricValues[2].value);
    const sessions = N(r.metricValues[3].value);
    const engagementDuration = N(r.metricValues[6].value);
    return {
      project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
      total_users: totalUsers, active_users: activeUsers, new_users: newUsers,
      returning_users: Math.max(0, totalUsers - newUsers),
      sessions,
      bounce_rate: N(r.metricValues[4].value) * 100,            // GA4 returns 0..1, display as %
      engagement_rate: N(r.metricValues[5].value) * 100,
      avg_engagement_time: sessions > 0 ? engagementDuration / sessions : 0,
      event_count: N(r.metricValues[7].value),
      organic_traffic: 0,
    };
  });
  await clearRange("website_metrics", projectId);
  await insertChunked("website_metrics", wmRows);

  // ============ traffic_sources ============
  // GA4: Reports → Acquisition → Traffic acquisition → sessionPrimaryChannelGroup
  // Pull raw GA4 metrics directly. No filtering, no manual rate recalculation.
  const ts = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "sessionPrimaryChannelGroup" }],
    metrics: [
      { name: "sessions" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
      { name: "bounceRate" },
      { name: "eventsPerSession" },
      { name: "eventCount" },
    ],
  });
  const tsRows = ts.rows.map((r: any) => {
    const sessions = N(r.metricValues[0].value);
    const engagedSessions = N(r.metricValues[1].value);
    const engagementRate = N(r.metricValues[2].value);       // 0..1
    const avgSessionDuration = N(r.metricValues[3].value);   // seconds
    const bounceRate = N(r.metricValues[4].value);           // 0..1
    const eventsPerSession = N(r.metricValues[5].value);
    const eventCount = N(r.metricValues[6].value);
    return {
      project_id: projectId,
      metric_date: fmt(r.dimensionValues[0].value),
      source: r.dimensionValues[1].value || "Unassigned",
      sessions,
      engaged_sessions: engagedSessions,
      engagement_rate: engagementRate * 100,
      avg_engagement_time_per_session: avgSessionDuration,
      bounce_rate: bounceRate * 100,
      events_per_session: eventsPerSession,
      event_count: eventCount,
    };
  });
  await clearRange("traffic_sources", projectId);
  await insertChunked("traffic_sources", tsRows);

  // ============ top_pages ============
  // GA4: Reports → Engagement → Pages and screens → pagePath
  const tp = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "pagePath" }],
    metrics: [
      { name: "screenPageViews" }, { name: "totalUsers" }, { name: "activeUsers" },
      { name: "newUsers" }, { name: "sessions" }, { name: "bounceRate" },
      { name: "engagementRate" }, { name: "userEngagementDuration" },
    ],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
  });
  const tpRows = tp.rows.map((r: any) => {
    const totalUsers = N(r.metricValues[1].value);
    const activeUsers = N(r.metricValues[2].value);
    const newUsers = N(r.metricValues[3].value);
    const sessions = N(r.metricValues[4].value);
    const engagementDuration = N(r.metricValues[7].value);
    return {
      project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
      page_path: r.dimensionValues[1].value,
      pageviews: N(r.metricValues[0].value),
      total_users: totalUsers, active_users: activeUsers, new_users: newUsers,
      returning_users: Math.max(0, totalUsers - newUsers),
      sessions,
      bounce_rate: N(r.metricValues[5].value) * 100,
      engagement_rate: N(r.metricValues[6].value) * 100,
      avg_engagement_time: sessions > 0 ? engagementDuration / sessions : 0,
    };
  });
  await clearRange("top_pages", projectId);
  await insertChunked("top_pages", tpRows);

  // ============ devices ============
  const dv = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "deviceCategory" }, { name: "operatingSystem" }],
    metrics: [
      { name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" },
      { name: "engagedSessions" }, { name: "userEngagementDuration" },
      { name: "eventCount" },
    ],
  });
  const dvRows = dv.rows.map((r: any) => {
    const sessions = N(r.metricValues[2].value);
    const engaged = N(r.metricValues[3].value);
    const duration = N(r.metricValues[4].value);
    return {
      project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
      device_category: r.dimensionValues[1].value, operating_system: r.dimensionValues[2].value,
      active_users: N(r.metricValues[0].value), new_users: N(r.metricValues[1].value),
      engaged_sessions: engaged,
      bounce_rate: sessions > 0 ? (1 - engaged / sessions) * 100 : 0,
      avg_engagement_time: sessions > 0 ? duration / sessions : 0,
      engagement_rate: sessions > 0 ? (engaged / sessions) * 100 : 0,
      event_count: N(r.metricValues[5].value),
    };
  });
  await clearRange("devices", projectId);
  await insertChunked("devices", dvRows);

  // ============ geography ============
  const gg = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "country" }, { name: "countryId" }, { name: "city" }],
    metrics: [
      { name: "totalUsers" }, { name: "sessions" },
      { name: "engagedSessions" },
    ],
  });
  const ggRows = gg.rows.map((r: any) => {
    const sessions = N(r.metricValues[1].value);
    const engaged = N(r.metricValues[2].value);
    return {
      project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
      country: r.dimensionValues[1].value, country_code: r.dimensionValues[2].value,
      city: r.dimensionValues[3].value,
      users: N(r.metricValues[0].value), sessions,
      engagement_rate: sessions > 0 ? (engaged / sessions) * 100 : 0,
    };
  });
  await clearRange("geography", projectId);
  await insertChunked("geography", ggRows);

  // ============ events ============
  const ev = await ga4RunReport(integrationId, propertyId, {
    dateRanges: [DATE_RANGE],
    dimensions: [{ name: "date" }, { name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
  });
  const evRows = ev.rows.map((r: any) => ({
    project_id: projectId, metric_date: fmt(r.dimensionValues[0].value),
    event_name: r.dimensionValues[1].value,
    event_count: N(r.metricValues[0].value), users: N(r.metricValues[1].value),
  }));
  await clearRange("events", projectId);
  await insertChunked("events", evRows);

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
