import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { connectGoogleBusinessLocation } from "@/lib/google-business-connect";
import { getGoogleBusinessLocations } from "@/lib/google-business-profile";
import { upsertGoogleConnection } from "@/lib/google-connections";
import { getMerchant } from "@/lib/merchants";
import { clearTemporaryGoogleTokens, consumeGoogleOAuthState, getGoogleOAuthConfig, setTemporaryGoogleTokens } from "@/lib/google-oauth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
  verified_email?: boolean;
};

export async function GET(request: Request) {
  const origin = getAppOrigin();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectToIntegrations(origin, { error: oauthError });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/login?error=Configuration%20Supabase%20manquante", origin));
  }

  const expectedState = await consumeGoogleOAuthState();

  if (!code || !state) {
    return redirectToIntegrations(origin, { error: "Retour Google incomplet : code ou state manquant." });
  }

  if (expectedState && state !== expectedState) {
    return redirectToIntegrations(origin, { error: "Retour Google invalide : state différent. Réessayez la connexion." });
  }

  if (!expectedState && !canContinueWithoutState(request)) {
    return redirectToIntegrations(origin, { error: "Session Google expirée avant le retour OAuth. Réessayez depuis la fenêtre principale." });
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
    return redirectToIntegrations(origin, { error: "Configuration Google OAuth manquante." });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    return redirectToIntegrations(origin, { error: tokenData.error_description ?? "Impossible de connecter Google Business." });
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });

  const userInfo = userInfoResponse.ok ? ((await userInfoResponse.json()) as GoogleUserInfo) : {};
  const email = userInfo.email ?? null;
  const grantedScopes = (tokenData.scope ?? "openid email https://www.googleapis.com/auth/business.manage")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  await setTemporaryGoogleTokens({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    email
  });

  try {
    await upsertGoogleConnection({
      merchant_id: merchant.id,
      google_account_email: email,
      access_token_encrypted: tokenData.access_token,
      ...(tokenData.refresh_token ? { refresh_token_encrypted: tokenData.refresh_token } : {}),
      granted_scopes: grantedScopes,
      status: "connected",
      connected_at: new Date().toISOString(),
      last_error: "Compte Google autorisé. Sélection de la fiche Google Business en cours."
    }, merchant);
    console.info("[google-business/oauth]", {
      stage: "base_connection_saved",
      merchantId: merchant.id,
      hasEmail: Boolean(email),
      hasRefreshToken: Boolean(tokenData.refresh_token)
    });
  } catch (error) {
    console.error("[google-business/oauth]", {
      stage: "base_connection_save_failed",
      merchantId: merchant.id,
      error: error instanceof Error ? error.message : error
    });
    return redirectToIntegrations(origin, { error: error instanceof Error ? error.message : "Impossible d’enregistrer la connexion Google." });
  }

  try {
    const locations = await getGoogleBusinessLocations(tokenData.access_token);

    if (locations.length > 0) {
      const result = await connectGoogleBusinessLocation({
        merchant,
        location: locations[0],
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        email,
        grantedScopes
      });

      const destination = new URL("/integrations", origin);
      destination.searchParams.set("saved", "google");
      destination.searchParams.set("imported", String(result.imported));
      if (result.syncError) {
        destination.searchParams.set("sync_error", result.syncError);
      }

      await clearTemporaryGoogleTokens();
      revalidateGooglePages();
      return NextResponse.redirect(destination);
    }

    await clearTemporaryGoogleTokens();
    revalidateGooglePages();
    return redirectToIntegrations(origin, {
      saved: "google",
      imported: "0",
      sync_error: "Aucune fiche Google Business trouvée sur ce compte."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de récupérer la fiche Google Business.";
    await upsertGoogleConnection({
      merchant_id: merchant.id,
      status: "connected",
      last_error: message
    }, merchant);
    await clearTemporaryGoogleTokens();
    revalidateGooglePages();
    return redirectToIntegrations(origin, { saved: "google", imported: "0", sync_error: message });
  }

  revalidateGooglePages();
  return redirectToIntegrations(origin, { saved: "google", imported: "0" });
}

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function revalidateGooglePages() {
  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/integrations");
}

function canContinueWithoutState(request: Request) {
  const url = new URL(request.url);
  return process.env.NODE_ENV !== "production" && ["localhost:3000", "127.0.0.1:3000"].includes(url.host);
}

function redirectToIntegrations(origin: string, params: Record<string, string>) {
  const destination = new URL("/integrations", origin);

  Object.entries(params).forEach(([key, value]) => {
    destination.searchParams.set(key, value);
  });

  return NextResponse.redirect(destination);
}
