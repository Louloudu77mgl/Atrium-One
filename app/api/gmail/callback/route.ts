import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getGmailConnection, upsertGmailConnection } from "@/lib/gmail-connections";
import { consumeGmailOAuthState, getGmailOAuthConfig, gmailSendScope } from "@/lib/gmail-oauth";
import { getMerchant } from "@/lib/merchants";
import { getCurrentUser } from "@/lib/supabase/server";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = { id?: string; email?: string; verified_email?: boolean };

export async function GET(request: Request) {
  const origin = getAppOriginFromRequest(request);
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = await consumeGmailOAuthState();

  if (oauthError) {
    const message = oauthError === "access_denied"
      ? "La connexion Gmail a été annulée."
      : "Google n’a pas pu autoriser la connexion Gmail.";
    return redirectToEmailing(origin, { gmail_error: message });
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToEmailing(origin, { gmail_error: "La connexion Gmail a expiré. Recommencez depuis AtriumOne." });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.redirect(new URL("/onboarding", origin));

  let config: ReturnType<typeof getGmailOAuthConfig>;
  try {
    config = getGmailOAuthConfig();
  } catch {
    return redirectToEmailing(origin, { gmail_error: "La connexion Gmail est temporairement indisponible." });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });
  const tokenData = await tokenResponse.json() as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error("[gmail/oauth] token_exchange_failed", {
      merchantId: merchant.id,
      providerError: tokenData.error ?? tokenResponse.status,
      description: tokenData.error_description ?? null
    });
    return redirectToEmailing(origin, { gmail_error: "Google n’a pas pu finaliser la connexion Gmail." });
  }

  const grantedScopes = (tokenData.scope ?? "").split(/\s+/).filter(Boolean);
  if (!grantedScopes.includes(gmailSendScope)) {
    return redirectToEmailing(origin, { gmail_error: "L’autorisation d’envoyer des e-mails n’a pas été accordée." });
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });
  const userInfo = userInfoResponse.ok ? await userInfoResponse.json() as GoogleUserInfo : {};
  if (!userInfo.email) {
    return redirectToEmailing(origin, { gmail_error: "Google n’a pas transmis l’adresse Gmail choisie." });
  }

  try {
    const existing = await getGmailConnection(merchant);
    const now = new Date();
    await upsertGmailConnection({
      merchant_id: merchant.id,
      google_account_id: userInfo.id ?? null,
      gmail_address: userInfo.email,
      access_token_encrypted: tokenData.access_token,
      refresh_token_encrypted: tokenData.refresh_token ?? existing?.refresh_token_encrypted ?? null,
      granted_scopes: grantedScopes,
      token_expires_at: new Date(now.getTime() + Math.max(60, tokenData.expires_in ?? 3600) * 1000).toISOString(),
      connected_at: now.toISOString(),
      last_checked_at: now.toISOString(),
      last_error: null,
      status: "connected"
    }, merchant);
    console.info("[gmail/oauth] connection_saved", {
      merchantId: merchant.id,
      hasRefreshToken: Boolean(tokenData.refresh_token ?? existing?.refresh_token_encrypted),
      grantedSendScope: true
    });
  } catch (error) {
    console.error("[gmail/oauth] connection_save_failed", {
      merchantId: merchant.id,
      message: error instanceof Error ? error.message : "unknown_error"
    });
    return redirectToEmailing(origin, {
      gmail_error: error instanceof Error ? error.message : "AtriumOne n’a pas pu enregistrer la connexion Gmail."
    });
  }

  revalidatePath("/emailing");
  revalidatePath("/integrations");
  return redirectToEmailing(origin, { saved: "gmail" });
}

function redirectToEmailing(origin: string, params: Record<string, string>) {
  const destination = new URL("/emailing", origin);
  Object.entries(params).forEach(([key, value]) => destination.searchParams.set(key, value));
  return NextResponse.redirect(destination);
}
