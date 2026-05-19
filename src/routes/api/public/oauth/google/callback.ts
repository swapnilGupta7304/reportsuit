import { createFileRoute } from "@tanstack/react-router";
import { verifyState } from "@/lib/oauth-state.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/oauth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        if (err) return Response.redirect(`${url.origin}/settings?oauth_error=${encodeURIComponent(err)}`, 302);
        if (!code || !state) return new Response("Missing code/state", { status: 400 });

        let payload;
        try { payload = verifyState(state); }
        catch (e: any) { return new Response(`Invalid state: ${e.message}`, { status: 400 }); }

        const redirectUri = `${url.origin}/api/public/oauth/google/callback`;
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: process.env.GA4_GOOGLE_CLIENT_ID!,
            client_secret: process.env.GA4_GOOGLE_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
        if (!tokenRes.ok) {
          const txt = await tokenRes.text();
          return new Response(`Token exchange failed: ${txt}`, { status: 500 });
        }
        const tokens = await tokenRes.json() as {
          access_token: string; refresh_token?: string; expires_in: number; scope?: string;
        };

        let email = "";
        try {
          const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          }).then(r => r.json()) as { email?: string };
          email = ui.email ?? "";
        } catch { /* non-fatal */ }

        const { data: existing } = await supabaseAdmin.from("integrations").select("*")
          .eq("organization_id", payload.org).eq("provider", payload.provider as any).maybeSingle();

        const existingMeta = (existing?.metadata ?? {}) as any;
        const metadata = {
          ...existingMeta,
          refresh_token: tokens.refresh_token ?? existingMeta.refresh_token,
          access_token: tokens.access_token,
          access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scope: tokens.scope,
          email,
        };

        if (existing) {
          await supabaseAdmin.from("integrations").update({
            status: "connected" as any, account_label: email || existing.account_label,
            metadata: metadata as any, updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("integrations").insert({
            organization_id: payload.org, provider: payload.provider as any,
            status: "connected" as any, account_label: email,
            created_by: payload.user, metadata: metadata as any,
          });
        }
        return Response.redirect(`${url.origin}${payload.returnTo}?connected=${payload.provider}`, 302);
      },
    },
  },
});
