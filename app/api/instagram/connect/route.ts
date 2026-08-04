import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getInstagramOAuthConfig, hasInstagramOAuthConfig, setInstagramOAuthState } from "@/lib/instagram-oauth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = getAppOrigin();

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

  if (!hasInstagramOAuthConfig()) {
    console.error("Instagram OAuth non configuré: variables Meta manquantes.");
    return NextResponse.redirect(
      new URL("/integrations/instagram?error=instagram_unavailable", origin)
    );
  }

  const config = getInstagramOAuthConfig();
  const state = randomUUID();
  await setInstagramOAuthState(state);

  const url = new URL(`https://www.facebook.com/${config.apiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management");

  if (request.headers.get("sec-fetch-dest") === "iframe") {
    return new NextResponse(createTopLevelRedirectHtml(url.toString()), {
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  }

  return NextResponse.redirect(url);
}

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function createTopLevelRedirectHtml(destination: string) {
  const safeDestination = JSON.stringify(destination);

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>Connexion Instagram</title>
  </head>
  <body>
    <p>Ouverture de la connexion Instagram…</p>
    <script>
      window.top.location.href = ${safeDestination};
    </script>
  </body>
</html>`;
}
