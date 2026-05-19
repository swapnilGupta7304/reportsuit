import { createFileRoute } from "@tanstack/react-router";
import { signState } from "@/lib/oauth-state.server";

export const Route = createFileRoute("/api/public/oauth/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const org = url.searchParams.get("org");
        const user = url.searchParams.get("user");
        const provider = url.searchParams.get("provider") || "ga4";
        const returnTo = url.searchParams.get("return") || "/settings";
        if (!org || !user) return new Response("Missing org or user", { status: 400 });

        const clientId = process.env.GA4_GOOGLE_CLIENT_ID;
        if (!clientId) return new Response("GA4_GOOGLE_CLIENT_ID not configured", { status: 500 });

        const state = signState({ org, user, provider, returnTo });
        const redirectUri = `${url.origin}/api/public/oauth/google/callback`;
        const scopes = [
          "https://www.googleapis.com/auth/analytics.readonly",
          "https://www.googleapis.com/auth/userinfo.email",
          "openid",
        ].join(" ");
        const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        g.searchParams.set("client_id", clientId);
        g.searchParams.set("redirect_uri", redirectUri);
        g.searchParams.set("response_type", "code");
        g.searchParams.set("access_type", "offline");
        g.searchParams.set("prompt", "consent");
        g.searchParams.set("include_granted_scopes", "true");
        g.searchParams.set("scope", scopes);
        g.searchParams.set("state", state);
        return Response.redirect(g.toString(), 302);
      },
    },
  },
});
