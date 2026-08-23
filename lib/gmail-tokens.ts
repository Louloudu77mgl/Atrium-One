import type { SupabaseClient } from "@supabase/supabase-js";
import { getGmailOAuthConfig } from "@/lib/gmail-oauth";
import { upsertGmailConnection } from "@/lib/gmail-connections";
import type { Database, GmailConnectionRow, MerchantRow } from "@/lib/supabase/types";

type RefreshResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function getFreshGmailAccessToken(
  connection: GmailConnectionRow,
  merchant: MerchantRow,
  supabaseClient?: SupabaseClient<Database>
) {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (connection.access_token_encrypted && expiresAt > Date.now() + 60_000) {
    return connection.access_token_encrypted;
  }

  if (!connection.refresh_token_encrypted) {
    if (connection.access_token_encrypted && !connection.token_expires_at) return connection.access_token_encrypted;
    throw new Error("Votre connexion Gmail doit être renouvelée.");
  }

  const config = getGmailOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: connection.refresh_token_encrypted,
      grant_type: "refresh_token"
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json() as RefreshResponse;

  if (!response.ok || !data.access_token) {
    const userMessage = data.error === "invalid_grant"
      ? "Votre connexion Gmail doit être renouvelée."
      : "Gmail est momentanément indisponible. Réessayez dans quelques instants.";
    await upsertGmailConnection({
      merchant_id: merchant.id,
      status: "error",
      last_error: userMessage,
      last_checked_at: new Date().toISOString()
    }, merchant, supabaseClient).catch(() => null);
    console.error("[gmail/token] refresh_failed", {
      merchantId: merchant.id,
      providerError: data.error ?? response.status,
      description: data.error_description ?? null
    });
    throw new Error(userMessage);
  }

  const now = new Date();
  await upsertGmailConnection({
    merchant_id: merchant.id,
    access_token_encrypted: data.access_token,
    token_expires_at: new Date(now.getTime() + Math.max(60, data.expires_in ?? 3600) * 1000).toISOString(),
    status: "connected",
    last_error: null,
    last_checked_at: now.toISOString()
  }, merchant, supabaseClient);
  return data.access_token;
}
