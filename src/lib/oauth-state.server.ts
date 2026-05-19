import crypto from "crypto";

function secret() {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return s;
}

export interface OAuthState {
  org: string;
  user: string;
  provider: string;
  returnTo: string;
  ts: number;
}

export function signState(payload: Omit<OAuthState, "ts">): string {
  const full: OAuthState = { ...payload, ts: Date.now() };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyState(state: string): OAuthState {
  const [data, sig] = state.split(".");
  if (!data || !sig) throw new Error("Malformed state");
  const expect = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  if (sig !== expect) throw new Error("Bad signature");
  const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as OAuthState;
  if (Date.now() - payload.ts > 15 * 60 * 1000) throw new Error("State expired");
  return payload;
}
