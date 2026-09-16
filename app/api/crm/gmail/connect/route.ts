import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { getCrmGmailConnection, getCrmGmailOAuthConfig, setCrmGmailState } from "@/lib/crm/gmail";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = getAppOriginFromRequest(request);
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.redirect(new URL("/dashboard", origin));
  try {
    const config = getCrmGmailOAuthConfig();
    const state = randomUUID();
    await setCrmGmailState(state);
    const connection = await getCrmGmailConnection().catch(() => null);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scopes);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    if (connection?.gmail_address) url.searchParams.set("login_hint", connection.gmail_address);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/crm/settings?gmail_error=Configuration+Gmail+CRM+indisponible", origin));
  }
}
