import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface TokenMeta {
  refresh_token?: string;
  access_token?: string;
  access_token_expires_at?: string;
  email?: string;
}

export async function getAccessToken(integrationId: string): Promise<string> {
  const { data: integ, error } = await supabaseAdmin
    .from("integrations").select("*").eq("id", integrationId).single();
  if (error || !integ) throw new Error("Integration not found");
  const meta = (integ.metadata ?? {}) as TokenMeta;
  if (meta.access_token && meta.access_token_expires_at &&
      new Date(meta.access_token_expires_at).getTime() > Date.now() + 60_000) {
    return meta.access_token;
  }
  if (!meta.refresh_token) throw new Error("No refresh token; reconnect required");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GA4_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GA4_GOOGLE_CLIENT_SECRET!,
      refresh_token: meta.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const tok = await res.json() as { access_token: string; expires_in: number };
  const updated: TokenMeta = {
    ...meta,
    access_token: tok.access_token,
    access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
  };
  await supabaseAdmin.from("integrations").update({ metadata: updated as any }).eq("id", integrationId);
  return tok.access_token;
}

export async function ga4ListProperties(integrationId: string) {
  const token = await getAccessToken(integrationId);
  const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`List GA4 properties failed: ${await res.text()}`);
  const j = await res.json() as any;
  const out: { propertyId: string; displayName: string; account: string }[] = [];
  for (const acc of j.accountSummaries ?? []) {
    for (const p of acc.propertySummaries ?? []) {
      out.push({
        propertyId: String(p.property).replace("properties/", ""),
        displayName: p.displayName,
        account: acc.displayName,
      });
    }
  }
  return out;
}

export async function ga4GetPropertyMeta(integrationId: string, propertyId: string) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Get GA4 property failed: ${await res.text()}`);
  const j = await res.json() as { timeZone?: string; currencyCode?: string; displayName?: string };
  return { timeZone: j.timeZone ?? "UTC", currencyCode: j.currencyCode ?? "USD", displayName: j.displayName };
}

/**
 * Paginated runReport. Returns concatenated rows across all pages.
 * Uses offset/limit to walk results — matches GA4 UI totals exactly.
 */
export async function ga4RunReport(integrationId: string, propertyId: string, body: Record<string, any>) {
  const token = await getAccessToken(integrationId);
  const pageSize = 100000; // GA4 max
  let offset = 0;
  let allRows: any[] = [];
  let rowCount = 0;
  let metricHeaders: any[] = [];
  let dimensionHeaders: any[] = [];

  while (true) {
    const payload = { ...body, limit: pageSize, offset, keepEmptyRows: false };
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`GA4 runReport failed: ${await res.text()}`);
    const j = await res.json() as any;
    metricHeaders = j.metricHeaders ?? metricHeaders;
    dimensionHeaders = j.dimensionHeaders ?? dimensionHeaders;
    rowCount = Number(j.rowCount ?? 0);
    const rows = j.rows ?? [];
    allRows = allRows.concat(rows);
    offset += rows.length;
    if (rows.length < pageSize || offset >= rowCount) break;
    if (offset > 500000) break; // hard safety
  }
  return { rows: allRows, rowCount, metricHeaders, dimensionHeaders };
}
