import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getInstagramOAuthConfig, consumeInstagramOAuthState } from "@/lib/instagram-oauth";
import { upsertInstagramConnection } from "@/lib/instagram-connections";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  error?: {
    message?: string;
  };
};

type InstagramProfileResponse = {
  id?: string;
  username?: string;
  error?: {
    message?: string;
  };
};

type MetaPage = {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: InstagramProfileResponse;
};

export async function GET(request: Request) {
  const origin = getAppOrigin();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/integrations/instagram?error=${encodeURIComponent(oauthError)}`, origin));
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/login?error=Configuration%20Supabase%20manquante", origin));
  }

  const expectedState = await consumeInstagramOAuthState();

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/integrations/instagram?error=Connexion%20Instagram%20invalide", origin));
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
  const tokenResponse = await fetch(`https://graph.facebook.com/${config.apiVersion}/oauth/access_token?${new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code
  }).toString()}`, {
    cache: "no-store"
  });
  const tokenData = (await tokenResponse.json()) as MetaTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    await upsertInstagramConnection({
      merchant_id: merchant.id,
      status: "error",
      last_error: tokenData.error?.message ?? "Impossible de connecter Instagram."
    }, merchant);

    return NextResponse.redirect(new URL(`/integrations/instagram?error=${encodeURIComponent(tokenData.error?.message ?? "Impossible de connecter Instagram.")}`, origin));
  }

  const longLivedResponse = await fetch(`https://graph.facebook.com/${config.apiVersion}/oauth/access_token?${new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    fb_exchange_token: tokenData.access_token
  }).toString()}`, {
    cache: "no-store"
  });
  const longLivedData = (await longLivedResponse.json()) as MetaTokenResponse;
  const userAccessToken = longLivedData.access_token ?? tokenData.access_token;

  const profileResponse = await fetch(`https://graph.facebook.com/${config.apiVersion}/me/accounts?${new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: userAccessToken
  }).toString()}`, { cache: "no-store" });

  let username: string | null = null;
  let accountId: string | null = null;
  let pageAccessToken: string | null = null;

  if (profileResponse.ok) {
    const profileData = (await profileResponse.json()) as { data?: MetaPage[] };
    const page = profileData.data?.find((candidate) => candidate.instagram_business_account?.id);
    username = page?.instagram_business_account?.username ?? null;
    accountId = page?.instagram_business_account?.id ?? null;
    pageAccessToken = page?.access_token ?? null;
  }

  await upsertInstagramConnection({
    merchant_id: merchant.id,
    instagram_account_id: accountId,
    instagram_username: username,
    access_token_encrypted: pageAccessToken ?? userAccessToken,
    status: accountId ? "connected" : "pending_configuration",
    connected_at: new Date().toISOString(),
    last_error: accountId ? null : "Aucun compte Instagram professionnel relié à une Page Facebook n’a été trouvé."
  }, merchant);

  return NextResponse.redirect(new URL("/integrations/instagram?saved=instagram", origin));
}

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
