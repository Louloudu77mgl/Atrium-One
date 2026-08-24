import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getMerchant } from "@/lib/merchants";
import { getInstagramOAuthConfig, getInstagramRedirectUri, consumeInstagramOAuthState } from "@/lib/instagram-oauth";
import { upsertInstagramConnection } from "@/lib/instagram-connections";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";
import type { MerchantRow } from "@/lib/supabase/types";

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
  const oauthErrorDescription = url.searchParams.get("error_description")
    ?? url.searchParams.get("error_message")
    ?? url.searchParams.get("error_reason");

  console.info("[instagram/callback] oauth_returned", {
    origin,
    hasCode: Boolean(code),
    hasState: Boolean(state),
    oauthError: oauthError ?? null,
    oauthErrorDescription: oauthErrorDescription ?? null
  });

  if (!hasSupabaseEnv()) {
    return createOAuthCompletionResponse(origin, {
      status: "error",
      message: "La connexion Instagram est temporairement indisponible."
    });
  }

  const expectedState = await consumeInstagramOAuthState();

  const user = await getCurrentUser();

  if (!user) {
    return createOAuthCompletionResponse(origin, {
      status: "error",
      message: "Votre session AtriumOne a expiré. Reconnectez-vous puis réessayez."
    });
  }

  const merchant = await getMerchant();

  if (!merchant) {
    return createOAuthCompletionResponse(origin, {
      status: "error",
      message: "Terminez la configuration de votre commerce avant de connecter Instagram."
    });
  }

  if (oauthError) {
    const message = mapOAuthError(oauthError, oauthErrorDescription);
    await recordInstagramError(merchant, message);
    return createOAuthCompletionResponse(origin, {
      status: "error",
      message
    });
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    await recordInstagramError(merchant, "Le retour sécurisé Instagram n’a pas pu être confirmé.");
    return createOAuthCompletionResponse(origin, {
      status: "error",
      message: "La connexion Instagram n’a pas pu être confirmée."
    });
  }

  const redirectUri = getInstagramRedirectUri(origin);
  const config = getInstagramOAuthConfig(redirectUri);
  let tokenResponse: Response;
  let tokenData: InstagramTokenResponse;

  try {
    tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
    tokenData = await tokenResponse.json() as InstagramTokenResponse;
  } catch (error) {
    console.error("[instagram/callback] token_exchange_failed", {
      merchantId: merchant.id,
      message: error instanceof Error ? error.message : "unknown_error"
    });
    await recordInstagramError(merchant, "Instagram n’a pas répondu pendant la connexion.");
    return createOAuthCompletionResponse(origin, {
      status: "error",
      message: "Instagram n’a pas pu finaliser la connexion. Réessayez dans quelques instants."
    });
  }

  if (!tokenResponse.ok || !tokenData.access_token) {
    await recordInstagramError(
      merchant,
      tokenData.error?.message ?? tokenData.error_message ?? "Impossible de connecter Instagram."
    );

    return createOAuthCompletionResponse(origin, {
      status: "error",
      message: "Instagram n’a pas pu finaliser la connexion. Réessayez dans quelques instants."
    });
  }

  const longLivedData = await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: config.clientSecret,
    access_token: tokenData.access_token
  }).toString()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  }).then(async (response) => response.ok ? await response.json() as InstagramTokenResponse : {})
    .catch(() => ({} as InstagramTokenResponse));
  const userAccessToken = longLivedData.access_token ?? tokenData.access_token;

  const profileResponse = await fetch(`https://graph.instagram.com/${config.apiVersion}/me?${new URLSearchParams({
    fields: "user_id,username",
    access_token: userAccessToken
  }).toString()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  }).catch(() => null);

  let username: string | null = null;
  let accountId = tokenData.user_id ? String(tokenData.user_id) : null;

  if (profileResponse?.ok) {
    const profileData = (await profileResponse.json()) as InstagramProfileResponse;
    username = profileData.username ?? null;
    accountId = String(profileData.user_id ?? profileData.id ?? accountId ?? "") || null;
  }

  try {
    await upsertInstagramConnection({
      merchant_id: merchant.id,
      instagram_account_id: accountId || null,
      instagram_username: username,
      access_token_encrypted: userAccessToken,
      status: accountId ? "connected" : "pending_configuration",
      connected_at: new Date().toISOString(),
      last_error: accountId ? null : "Impossible de récupérer le compte Instagram professionnel après la connexion."
    }, merchant);
  } catch (error) {
    console.error("[instagram/callback] connection_persist_failed", {
      merchantId: merchant.id,
      message: error instanceof Error ? error.message : "unknown_error"
    });
    return createOAuthCompletionResponse(origin, {
      status: "error",
      message: "AtriumOne n’a pas pu enregistrer la connexion Instagram. Réessayez après quelques instants."
    });
  }

  return createOAuthCompletionResponse(origin, {
    status: accountId ? "connected" : "action_required",
    message: accountId
      ? "Votre compte Instagram est connecté."
      : "Instagram est autorisé, mais le compte professionnel doit encore être vérifié."
  });
}

function mapOAuthError(error: string, description?: string | null) {
  const source = `${error} ${description ?? ""}`.toLocaleLowerCase("fr-FR");
  if (source.includes("access_denied") || source.includes("declined") || source.includes("denied")) {
    return "L’autorisation Instagram a été refusée ou annulée.";
  }
  if (source.includes("scope") || source.includes("permission")) {
    return "Meta n’a pas accordé les autorisations Instagram nécessaires à la publication.";
  }
  if (source.includes("professional") || source.includes("business")) {
    return "Le compte Instagram doit être configuré en compte professionnel.";
  }
  return description?.trim() || "La connexion Instagram n’a pas été autorisée.";
}

function createOAuthCompletionResponse(
  origin: string,
  result: { status: "connected" | "action_required" | "error"; message: string }
) {
  const targetOrigin = new URL(origin).origin;
  const destination = new URL(
    result.status === "connected"
      ? "/social?saved=instagram"
      : `/social?error=${encodeURIComponent(result.message)}`,
    origin
  ).toString();
  const payload = JSON.stringify({
    type: "atrium:instagram-oauth-complete",
    status: result.status,
    message: result.message
  }).replace(/</g, "\\u003c");

  return new NextResponse(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connexion Instagram terminée</title>
  </head>
  <body>
    <p>Retour sécurisé vers AtriumOne…</p>
    <script>
      const payload = ${payload};
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
        window.close();
        window.setTimeout(() => window.location.replace(${JSON.stringify(destination)}), 500);
      } else {
        window.location.replace(${JSON.stringify(destination)});
      }
    </script>
  </body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function recordInstagramError(merchant: MerchantRow, message: string) {
  try {
    await upsertInstagramConnection({
      merchant_id: merchant.id,
      status: "error",
      last_error: message
    }, merchant);
  } catch (error) {
    console.error("[instagram/callback] error_persist_failed", {
      merchantId: merchant.id,
      message: error instanceof Error ? error.message : "unknown_error"
    });
  }
}
