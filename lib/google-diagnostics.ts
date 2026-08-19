import { getGoogleBusinessLocations } from "@/lib/google-business-profile";
import { getTemporaryGoogleTokens } from "@/lib/google-oauth";
import type { GoogleConnectionRow } from "@/lib/supabase/types";

export type GoogleDiagnosticState = {
  oauthConfigured: boolean;
  redirectUri: string | null;
  clientId: string | null;
  clientSecretSuffix: string | null;
  clientSecretLength: number | null;
  clientSecretHasWhitespace: boolean;
  tokenAvailable: boolean;
  googleConnected: boolean;
  locationConnected: boolean;
  locationsCount: number | null;
  reviewsCount: number | null;
  latestSync: string | null;
  latestError: string | null;
  scopes: string[];
};

export async function getGoogleDiagnosticState(connection?: GoogleConnectionRow | null, options: { liveCheck?: boolean } = {}): Promise<GoogleDiagnosticState> {
  const oauthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
  const clientId = process.env.GOOGLE_CLIENT_ID ?? null;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? null;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? null;

  const temporaryTokens = await getTemporaryGoogleTokens();
  const token = connection?.access_token_encrypted ?? temporaryTokens.accessToken;
  const tokenAvailable = Boolean(token);
  const scopes = connection?.granted_scopes ?? [];
  let locationsCount: number | null = null;
  let reviewsCount: number | null = null;
  let latestError = connection?.last_error ?? null;

  if (token && options.liveCheck) {
    try {
      const locations = await getGoogleBusinessLocations(token);
      locationsCount = locations.length;

      if (connection?.google_location_id) {
        reviewsCount = await getGoogleBusinessReviewsCount(token, connection.google_location_id);
      }
    } catch (error) {
      latestError = error instanceof Error ? error.message : "Diagnostic Google indisponible.";
    }
  }

  return {
    oauthConfigured,
    redirectUri,
    clientId,
    clientSecretSuffix: clientSecret ? clientSecret.slice(-4) : null,
    clientSecretLength: clientSecret?.length ?? null,
    clientSecretHasWhitespace: Boolean(clientSecret && /\s/.test(clientSecret)),
    tokenAvailable,
    googleConnected: connection?.status === "connected",
    locationConnected: Boolean(connection?.google_location_id),
    locationsCount,
    reviewsCount,
    latestSync: connection?.last_sync_at ?? null,
    latestError,
    scopes
  };
}

async function getGoogleBusinessReviewsCount(accessToken: string, locationId: string) {
  const url = new URL(`https://mybusiness.googleapis.com/v4/${locationId}/reviews`);
  url.searchParams.set("pageSize", "50");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Impossible de récupérer les avis Google Business.");
  }

  const data = (await response.json()) as { reviews?: unknown[] };
  return data.reviews?.length ?? 0;
}
