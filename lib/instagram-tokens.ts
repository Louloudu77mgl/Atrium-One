import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyInstagramMetaError,
  createInstagramIntegrationError,
  InstagramIntegrationError,
  type InstagramFailureCode
} from "@/lib/instagram-errors";
import type { Database, InstagramConnectionRow } from "@/lib/supabase/types";

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string; code?: number; type?: string; error_subcode?: number };
};

type InstagramProfileResponse = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
  error?: { message?: string; code?: number; type?: string; error_subcode?: number };
};

export async function getValidInstagramAccessToken({
  merchantId,
  supabaseClient
}: {
  merchantId: string;
  supabaseClient: SupabaseClient<Database>;
}) {
  const { data: storedConnection, error } = await supabaseClient
    .from("instagram_connections")
    .select("*")
    .eq("merchant_id", merchantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!storedConnection?.access_token_encrypted || !storedConnection.instagram_account_id) {
    throw connectionStateError("Instagram n’est pas connecté.", "connection_invalid");
  }
  if (["expired", "revoked"].includes(storedConnection.status)) {
    throw connectionStateError(
      storedConnection.status === "expired"
        ? "Votre connexion Instagram a expiré. Reconnectez Instagram pour reprendre les publications automatiques."
        : "Votre autorisation Instagram n’est plus active. Reconnectez Instagram pour reprendre les publications.",
      storedConnection.status === "expired" ? "token_expired" : "token_revoked"
    );
  }
  if (["disconnected", "pending_configuration", "error"].includes(storedConnection.status)) {
    throw connectionStateError("Reconnectez Instagram avant de publier.", "connection_invalid");
  }

  let connection = storedConnection;
  const now = Date.now();
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;

  if (expiresAt !== null && expiresAt <= now) {
    await markInstagramConnectionFailure({
      merchantId,
      supabaseClient,
      status: "expired",
      message: "Votre connexion Instagram a expiré. Reconnectez Instagram pour reprendre les publications automatiques."
    });
    throw connectionStateError(
      "Votre connexion Instagram a expiré. Reconnectez Instagram pour reprendre les publications automatiques.",
      "token_expired"
    );
  }

  const connectedAt = new Date(connection.connected_at).getTime();
  const refreshAllowedByAge = Number.isFinite(connectedAt) && now - connectedAt >= MIN_REFRESH_AGE_MS;
  const shouldRefresh = refreshAllowedByAge && (expiresAt === null || expiresAt - now <= REFRESH_WINDOW_MS);

  if (shouldRefresh) {
    try {
      connection = expiresAt === null
        ? await upgradeLegacyInstagramToken(connection, supabaseClient)
        : await refreshInstagramToken(connection, supabaseClient);
    } catch (refreshError) {
      if (refreshError instanceof InstagramIntegrationError && ["token_expired", "token_revoked"].includes(refreshError.details.failure_code)) {
        throw refreshError;
      }
      await updateConnectionHealth(supabaseClient, merchantId, {
        status: "expiring",
        last_error: "Le renouvellement automatique Instagram sera retenté.",
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      console.error("[instagram/token] refresh_deferred", {
        merchantId,
        failureCode: refreshError instanceof InstagramIntegrationError ? refreshError.details.failure_code : "refresh_failed",
        message: refreshError instanceof Error ? refreshError.message : "unknown_error"
      });
    }
  }

  const validAccessToken = connection.access_token_encrypted;
  if (!validAccessToken) {
    throw connectionStateError("Reconnectez Instagram avant de publier.", "connection_invalid");
  }

  const profile = await validateInstagramToken({
    token: validAccessToken,
    version: process.env.INSTAGRAM_GRAPH_API_VERSION ?? "v23.0",
    merchantId,
    supabaseClient
  });
  const profileAccountId = String(profile.user_id ?? "");

  if (!profileAccountId || profileAccountId !== connection.instagram_account_id || !profile.username || !["BUSINESS", "MEDIA_CREATOR"].includes(profile.account_type ?? "")) {
    await markInstagramConnectionFailure({
      merchantId,
      supabaseClient,
      status: "error",
      message: "Le compte Instagram professionnel connecté n’est plus accessible."
    });
    throw connectionStateError("Le compte Instagram connecté doit être vérifié avant de publier.", "account_inaccessible");
  }

  const refreshedExpiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;
  const healthyStatus = refreshedExpiresAt !== null && refreshedExpiresAt - Date.now() <= REFRESH_WINDOW_MS ? "expiring" : "connected";
  const checkedAt = new Date().toISOString();
  await updateConnectionHealth(supabaseClient, merchantId, {
    status: healthyStatus,
    instagram_username: profile.username,
    last_checked_at: checkedAt,
    last_error: null,
    updated_at: checkedAt
  });

  return {
    accessToken: validAccessToken,
    connection: { ...connection, status: healthyStatus, instagram_username: profile.username, last_checked_at: checkedAt, last_error: null }
  };
}

async function upgradeLegacyInstagramToken(connection: InstagramConnectionRow, supabaseClient: SupabaseClient<Database>) {
  const clientSecret = process.env.INSTAGRAM_APP_SECRET ?? process.env.META_CLIENT_SECRET;
  if (clientSecret) {
    const url = new URL("https://graph.instagram.com/access_token");
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("access_token", connection.access_token_encrypted ?? "");
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const data = await readJson<MetaTokenResponse>(response);
      if (response.ok && data.access_token) {
        return persistRenewedInstagramToken(connection, { ...data, access_token: data.access_token }, supabaseClient, "upgraded");
      }
      const classified = classifyInstagramMetaError(data.error);
      if (["token_expired", "token_revoked"].includes(classified.failureCode)) {
        const status = classified.failureCode === "token_expired" ? "expired" : "revoked";
        await markInstagramConnectionFailure({ merchantId: connection.merchant_id, supabaseClient, status, message: classified.userMessage });
        throw createInstagramIntegrationError({
          message: classified.userMessage,
          apiError: classified.apiMessage,
          failureCode: classified.failureCode,
          action: "instagram_exchange_legacy_token",
          method: "GET",
          endpoint: "/access_token",
          httpStatus: response.status,
          metaCode: data.error?.code
        });
      }
    } catch (error) {
      if (error instanceof InstagramIntegrationError) throw error;
      console.error("[instagram/token] legacy_exchange_deferred", {
        merchantId: connection.merchant_id,
        message: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }

  return refreshInstagramToken(connection, supabaseClient);
}

async function refreshInstagramToken(connection: InstagramConnectionRow, supabaseClient: SupabaseClient<Database>) {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", connection.access_token_encrypted ?? "");

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw createInstagramIntegrationError({
      message: "Le renouvellement automatique Instagram a temporairement échoué.",
      apiError: error instanceof Error ? error.message : "Network error",
      failureCode: "refresh_failed",
      action: "instagram_refresh_token",
      method: "GET",
      endpoint: "/refresh_access_token"
    });
  }

  const data = await readJson<MetaTokenResponse>(response);
  if (!response.ok || !data.access_token) {
    const classified = classifyInstagramMetaError(data.error);
    const status = classified.failureCode === "token_expired" ? "expired" : classified.failureCode === "token_revoked" ? "revoked" : "expiring";
    await markInstagramConnectionFailure({
      merchantId: connection.merchant_id,
      supabaseClient,
      status,
      message: classified.userMessage
    });
    throw createInstagramIntegrationError({
      message: classified.userMessage,
      apiError: classified.apiMessage,
      failureCode: classified.failureCode === "graph_api_error" ? "refresh_failed" : classified.failureCode,
      action: "instagram_refresh_token",
      method: "GET",
      endpoint: "/refresh_access_token",
      httpStatus: response.status,
      metaCode: data.error?.code
    });
  }

  return persistRenewedInstagramToken(connection, { ...data, access_token: data.access_token }, supabaseClient, "refreshed");
}

async function persistRenewedInstagramToken(
  connection: InstagramConnectionRow,
  data: MetaTokenResponse & { access_token: string },
  supabaseClient: SupabaseClient<Database>,
  action: "upgraded" | "refreshed"
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(60, data.expires_in ?? 60 * 24 * 60 * 60) * 1000).toISOString();
  const { data: updated, error } = await supabaseClient
    .from("instagram_connections")
    .update({
      access_token_encrypted: data.access_token,
      token_expires_at: expiresAt,
      status: "connected",
      last_checked_at: now.toISOString(),
      last_error: null,
      updated_at: now.toISOString()
    })
    .eq("merchant_id", connection.merchant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  console.info(`[instagram/token] ${action}`, {
    merchantId: connection.merchant_id,
    expiresAt
  });
  return updated;
}

async function validateInstagramToken({
  token,
  version,
  merchantId,
  supabaseClient
}: {
  token: string;
  version: string;
  merchantId: string;
  supabaseClient: SupabaseClient<Database>;
}) {
  const url = new URL(`https://graph.instagram.com/${version}/me`);
  url.searchParams.set("fields", "id,user_id,username,account_type");
  url.searchParams.set("access_token", token);
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw createInstagramIntegrationError({
      message: "Instagram n’a pas pu vérifier la connexion pour le moment.",
      apiError: error instanceof Error ? error.message : "Network error",
      failureCode: "graph_api_error",
      action: "instagram_validate_token",
      method: "GET",
      endpoint: "/me?fields=id,user_id,username,account_type"
    });
  }

  const data = await readJson<InstagramProfileResponse>(response);
  if (!response.ok) {
    const classified = classifyInstagramMetaError(data.error);
    const status = classified.failureCode === "token_expired" ? "expired" : classified.failureCode === "token_revoked" ? "revoked" : "error";
    await markInstagramConnectionFailure({ merchantId, supabaseClient, status, message: classified.userMessage });
    throw createInstagramIntegrationError({
      message: classified.userMessage,
      apiError: classified.apiMessage,
      failureCode: classified.failureCode,
      action: "instagram_validate_token",
      method: "GET",
      endpoint: "/me?fields=id,user_id,username,account_type",
      httpStatus: response.status,
      metaCode: data.error?.code
    });
  }
  return data;
}

export async function markInstagramConnectionFailure({
  merchantId,
  supabaseClient,
  status,
  message
}: {
  merchantId: string;
  supabaseClient: SupabaseClient<Database>;
  status: "expiring" | "expired" | "revoked" | "error" | "pending_configuration";
  message: string;
}) {
  const now = new Date().toISOString();
  await updateConnectionHealth(supabaseClient, merchantId, {
    status,
    last_error: message,
    last_checked_at: now,
    updated_at: now
  });
}

async function updateConnectionHealth(
  supabaseClient: SupabaseClient<Database>,
  merchantId: string,
  update: Database["public"]["Tables"]["instagram_connections"]["Update"]
) {
  const { error } = await supabaseClient.from("instagram_connections").update(update).eq("merchant_id", merchantId);
  if (error) throw new Error(error.message);
}

function connectionStateError(message: string, failureCode: InstagramFailureCode) {
  return createInstagramIntegrationError({
    message,
    failureCode,
    action: "instagram_get_valid_token",
    method: "GET",
    endpoint: "instagram_connections",
    apiError: message
  });
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
