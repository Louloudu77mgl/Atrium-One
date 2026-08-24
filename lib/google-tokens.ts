import type { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleOAuthConfig } from "@/lib/google-oauth";
import { upsertGoogleConnection } from "@/lib/google-connections";
import type { Database, GoogleConnectionRow, MerchantRow } from "@/lib/supabase/types";

type RefreshResponse = {
  access_token?: string;
  error_description?: string;
};

export async function getFreshGoogleAccessToken(
  connection: GoogleConnectionRow,
  merchant: MerchantRow,
  databaseClient?: SupabaseClient<Database>
) {
  if (!connection.refresh_token_encrypted) {
    if (connection.access_token_encrypted) return connection.access_token_encrypted;
    throw new Error("Aucun token Google disponible. Reconnectez Google Business.");
  }

  const config = getGoogleOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: connection.refresh_token_encrypted,
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });
  const data = (await response.json()) as RefreshResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Impossible de renouveler l’accès Google.");
  }

  await upsertGoogleConnection({
    merchant_id: merchant.id,
    access_token_encrypted: data.access_token,
    status: "connected",
    last_error: null
  }, merchant, databaseClient);

  return data.access_token;
}
