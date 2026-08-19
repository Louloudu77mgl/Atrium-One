import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getMerchant } from "@/lib/merchants";
import { getGoogleOAuthConfig, googleBusinessScope, setGoogleOAuthState } from "@/lib/google-oauth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = getAppOriginFromRequest(request);

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/login?error=Configuration%20Supabase%20manquante", origin));
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  let config: ReturnType<typeof getGoogleOAuthConfig>;

  try {
    config = getGoogleOAuthConfig();
  } catch {
    return NextResponse.redirect(new URL("/settings/google-business?error=Configuration%20Google%20OAuth%20manquante", origin));
  }

  const state = randomUUID();
  await setGoogleOAuthState(state);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", googleBusinessScope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  if (request.headers.get("sec-fetch-dest") === "iframe") {
    return new NextResponse(createTopLevelRedirectHtml(url.toString()), {
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  }

  return NextResponse.redirect(url);
}

function createTopLevelRedirectHtml(destination: string) {
  const safeDestination = JSON.stringify(destination);

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>Connexion Google</title>
  </head>
  <body>
    <p>Ouverture de la connexion Google…</p>
    <script>
      window.top.location.href = ${safeDestination};
    </script>
  </body>
</html>`;
}
