import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { consumeCrmGmailState, getCrmGmailConnection, getCrmGmailOAuthConfig, upsertCrmGmailConnection } from "@/lib/crm/gmail";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = getAppOriginFromRequest(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = await consumeCrmGmailState();
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.redirect(new URL("/dashboard", origin));
  if (url.searchParams.get("error") || !code || !state || state !== expected) return redirect(origin, "gmail_error", "La connexion Gmail AtriumOne a été annulée ou a expiré.");
  try {
    const config = getCrmGmailOAuthConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" }), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!tokenResponse.ok || !token.access_token) throw new Error("Google n’a pas finalisé la connexion.");
    const scopes = (token.scope ?? "").split(/\s+/).filter(Boolean);
    if (!scopes.includes(config.sendScope)) throw new Error("L’autorisation Gmail d’envoi n’a pas été accordée.");
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const profile = await profileResponse.json() as { id?: string; email?: string };
    if (!profileResponse.ok || !profile.email) throw new Error("Google n’a pas transmis l’adresse Gmail.");
    const existing = await getCrmGmailConnection();
    const now = new Date();
    await upsertCrmGmailConnection({ google_account_id: profile.id ?? null, gmail_address: profile.email, access_token_encrypted: token.access_token, refresh_token_encrypted: token.refresh_token ?? existing?.refresh_token_encrypted ?? null, granted_scopes: scopes, token_expires_at: new Date(now.getTime() + Math.max(60, token.expires_in ?? 3600) * 1000).toISOString(), connected_at: now.toISOString(), last_checked_at: now.toISOString(), last_error: null, status: "connected" });
    revalidatePath("/crm/settings");
    return redirect(origin, "saved", "gmail");
  } catch (error) {
    return redirect(origin, "gmail_error", error instanceof Error ? error.message : "Connexion Gmail impossible.");
  }
}

function redirect(origin: string, key: string, value: string) {
  const destination = new URL("/crm/settings", origin);
  destination.searchParams.set(key, value);
  return NextResponse.redirect(destination);
}
