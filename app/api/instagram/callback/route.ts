import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getMerchant } from "@/lib/merchants";
import { getInstagramOAuthConfig, consumeInstagramOAuthState } from "@/lib/instagram-oauth";
import { upsertInstagramConnection } from "@/lib/instagram-connections";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

type InstagramTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user_id?: number | string;
  error_type?: string;
  error_message?: string;
  error?: {
    message?: string;
  };
};

type InstagramProfileResponse = {
  id?: string | number;
  user_id?: string | number;
  username?: string;
  error?: {
    message?: string;
  };
};

export async function GET(request: Request) {
  const origin = getAppOriginFromRequest(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/social?error=${encodeURIComponent(oauthError)}`, origin));
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/login?error=Configuration%20Supabase%20manquante", origin));
  }

  const expectedState = await consumeInstagramOAuthState();

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/social?error=Connexion%20Instagram%20invalide", origin));
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  const config = getInstagramOAuthConfig();
  const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code
    }),
    cache: "no-store"
  });
  const tokenData = (await tokenResponse.json()) as InstagramTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    await upsertInstagramConnection({
      merchant_id: merchant.id,
      status: "error",
      last_error: tokenData.error?.message ?? tokenData.error_message ?? "Impossible de connecter Instagram."
    }, merchant);

    return NextResponse.redirect(
      new URL(
        `/social?error=${encodeURIComponent(tokenData.error?.message ?? tokenData.error_message ?? "Impossible de connecter Instagram.")}`,
        origin
      )
    );
  }

  const longLivedResponse = await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: config.clientSecret,
    access_token: tokenData.access_token
  }).toString()}`, {
    cache: "no-store"
  });
  const longLivedData = (await longLivedResponse.json()) as InstagramTokenResponse;
  const userAccessToken = longLivedData.access_token ?? tokenData.access_token;

  const profileResponse = await fetch(`https://graph.instagram.com/${config.apiVersion}/me?${new URLSearchParams({
    fields: "user_id,username",
    access_token: userAccessToken
  }).toString()}`, { cache: "no-store" });

  let username: string | null = null;
  let accountId = tokenData.user_id ? String(tokenData.user_id) : null;

  if (profileResponse.ok) {
    const profileData = (await profileResponse.json()) as InstagramProfileResponse;
    username = profileData.username ?? null;
    accountId = String(profileData.user_id ?? profileData.id ?? accountId ?? "") || null;
  }

  await upsertInstagramConnection({
    merchant_id: merchant.id,
    instagram_account_id: accountId || null,
    instagram_username: username,
    access_token_encrypted: userAccessToken,
    status: accountId ? "connected" : "pending_configuration",
    connected_at: new Date().toISOString(),
    last_error: accountId ? null : "Impossible de récupérer le compte Instagram professionnel après la connexion."
  }, merchant);

  return NextResponse.redirect(new URL("/social?saved=instagram", origin));
}
