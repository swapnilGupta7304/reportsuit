/**
 * Google Play Console integration via Service Account.
 *
 * Uses GOOGLE_SERVICE_ACCOUNT_JSON (a Google Cloud service account key)
 * to sign a JWT, exchange it for an access token, then query the
 * Google Play Developer Reporting API for crash/ANR/engagement metrics.
 *
 * The service account must be invited to the Play Console with
 * "App information (read-only)" or similar permissions.
 *
 * Reporting API docs:
 *  https://developers.google.com/play/developer/reporting/reference/rest
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SCOPES = [
  "https://www.googleapis.com/auth/playdeveloperreporting",
  "https://www.googleapis.com/auth/androidpublisher",
].join(" ");

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function getKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret is not configured");
  let key: ServiceAccountKey;
  try { key = JSON.parse(raw); }
  catch { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON"); }
  if (!key.client_email || !key.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }
  return key;
}

function b64url(buf: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof buf === "string") bytes = new TextEncoder().encode(buf);
  else if (buf instanceof Uint8Array) bytes = buf;
  else bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let _cachedToken: { token: string; expiresAt: number } | null = null;

export async function getPlayAccessToken(): Promise<string> {
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 60_000) return _cachedToken.token;
  const key = getKey();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: key.client_email, scope: SCOPES, aud: key.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", pemToArrayBuffer(key.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch(claims.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Play access-token exchange failed: ${await res.text()}`);
  const j = await res.json() as { access_token: string; expires_in: number };
  _cachedToken = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export async function getServiceAccountEmail(): Promise<string> {
  try { return getKey().client_email; }
  catch { return ""; }
}

interface MetricRow {
  startTime: { year: number; month: number; day: number };
  metrics: Record<string, { decimalValue?: { value: string }; doubleValue?: number; int64Value?: string }>;
}
function metricValue(m: MetricRow["metrics"][string]): number {
  if (!m) return 0;
  if (m.decimalValue?.value) return Number(m.decimalValue.value);
  if (typeof m.doubleValue === "number") return m.doubleValue;
  if (m.int64Value) return Number(m.int64Value);
  return 0;
}

async function queryMetricSet(token: string, packageName: string, metricSet: string, metrics: string[]) {
  const url = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${encodeURIComponent(packageName)}/${metricSet}:query`;
  // Query last 30 daily aggregations
  const end = new Date(); end.setDate(end.getDate() - 1);
  const start = new Date(end); start.setDate(end.getDate() - 30);
  const body = {
    timelineSpec: {
      aggregationPeriod: "DAILY",
      startTime: { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1, day: start.getUTCDate() },
      endTime: { year: end.getUTCFullYear(), month: end.getUTCMonth() + 1, day: end.getUTCDate() },
    },
    metrics, pageSize: 1000,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Some metric sets are not available for every app — return empty instead of throwing
    return [] as MetricRow[];
  }
  const j = await res.json() as { rows?: MetricRow[] };
  return j.rows ?? [];
}

function dateKey(d: { year: number; month: number; day: number }) {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

export async function syncProjectPlayConsole(projectId: string) {
  const { data: app, error } = await supabaseAdmin.from("play_console_apps")
    .select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!app) throw new Error("No Play Console app linked to this project");
  const packageName = app.package_name;
  const token = await getPlayAccessToken();

  // Fetch metric sets in parallel
  const [crashRows, anrRows, errorRows] = await Promise.all([
    queryMetricSet(token, packageName, "crashRateMetricSet", ["crashRate", "userPerceivedCrashRate", "distinctUsers"]),
    queryMetricSet(token, packageName, "anrRateMetricSet", ["anrRate", "userPerceivedAnrRate", "distinctUsers"]),
    queryMetricSet(token, packageName, "errorCountMetricSet", ["errorReportCount", "distinctUsers"]),
  ]);

  // Merge by date
  const byDate = new Map<string, any>();
  function ensure(d: string) {
    if (!byDate.has(d)) {
      byDate.set(d, {
        project_id: projectId, metric_date: d,
        installs: 0, organic_installs: 0, uninstalls: 0,
        active_users: 0, dau: 0, mau: 0, sessions: 0,
        crash_rate: 0, anr_rate: 0, avg_rating: 0, retention_rate: 0,
        store_visitors: 0, install_conversion_rate: 0,
        metadata: {},
      });
    }
    return byDate.get(d);
  }
  for (const r of crashRows) {
    const row = ensure(dateKey(r.startTime));
    row.crash_rate = metricValue(r.metrics.crashRate) * 100;
    row.active_users = Math.max(row.active_users, metricValue(r.metrics.distinctUsers));
  }
  for (const r of anrRows) {
    const row = ensure(dateKey(r.startTime));
    row.anr_rate = metricValue(r.metrics.anrRate) * 100;
    row.active_users = Math.max(row.active_users, metricValue(r.metrics.distinctUsers));
  }
  for (const r of errorRows) {
    const row = ensure(dateKey(r.startTime));
    row.metadata.error_count = metricValue(r.metrics.errorReportCount);
  }
  const rows = [...byDate.values()];

  // Clear last 35 days then insert
  const start = new Date(); start.setDate(start.getDate() - 35);
  await supabaseAdmin.from("app_metrics").delete()
    .eq("project_id", projectId)
    .gte("metric_date", start.toISOString().slice(0, 10));
  if (rows.length) {
    const { error: insErr } = await supabaseAdmin.from("app_metrics").insert(rows);
    if (insErr) throw new Error(`app_metrics insert failed: ${insErr.message}`);
  }

  await supabaseAdmin.from("play_console_apps")
    .update({ last_synced_at: new Date().toISOString() }).eq("id", app.id);

  // Mark integration as connected
  await supabaseAdmin.from("integrations").update({
    last_synced_at: new Date().toISOString(),
    status: "connected" as any,
  }).eq("id", app.integration_id);

  return { project_id: projectId, days: rows.length };
}
