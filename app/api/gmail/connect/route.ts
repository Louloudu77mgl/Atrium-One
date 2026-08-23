import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getGmailConnection } from "@/lib/gmail-connections";
import { getGmailOAuthConfig, gmailOAuthScopes, setGmailOAuthState } from "@/lib/gmail-oauth";
import { getMerchant } from "@/lib/merchants";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = getAppOriginFromRequest(request);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.redirect(new URL("/onboarding", origin));

  let config: ReturnType<typeof getGmailOAuthConfig>;
  try {
    config = getGmailOAuthConfig();
  } catch {
    return redirectToEmailing(origin, "La connexion Gmail est temporairement indisponible.");
  }

  const state = randomUUID();
  await setGmailOAuthState(state);
  const connection = await getGmailConnection(merchant).catch(() => null);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", gmailOAuthScopes);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  if (connection?.gmail_address) url.searchParams.set("login_hint", connection.gmail_address);
  return NextResponse.redirect(url);
}

function redirectToEmailing(origin: string, error: string) {
  const destination = new URL("/emailing", origin);
  destination.searchParams.set("gmail_error", error);
  return NextResponse.redirect(destination);
}
