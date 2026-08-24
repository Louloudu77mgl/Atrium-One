import { syncGoogleBusinessReviews } from "@/lib/google-review-sync";
import { runReviewAutomationsForMerchant } from "@/lib/review-automation-runner";
import { upsertGoogleConnection } from "@/lib/google-connections";
import type { GoogleBusinessLocation } from "@/lib/google-business-profile";
import type { MerchantRow } from "@/lib/supabase/types";

export type GoogleBusinessConnectResult = {
  imported: number;
  syncError: string | null;
};

export async function connectGoogleBusinessLocation({
  merchant,
  location,
  accessToken,
  refreshToken,
  email,
  grantedScopes
}: {
  merchant: MerchantRow;
  location: GoogleBusinessLocation;
  accessToken: string;
  refreshToken: string | null;
  email: string | null;
  grantedScopes: string[];
}): Promise<GoogleBusinessConnectResult> {
  const connection = await upsertGoogleConnection({
    merchant_id: merchant.id,
    google_account_email: email,
    google_location_id: location.locationId,
    google_location_name: location.locationName,
    access_token_encrypted: accessToken,
    refresh_token_encrypted: refreshToken,
    granted_scopes: grantedScopes,
    status: "connected",
    connected_at: new Date().toISOString(),
    last_error: null
  }, merchant);

  try {
    const imported = await syncGoogleBusinessReviews(connection, merchant);
    await runReviewAutomationsForMerchant(merchant.id, 5);
    return { imported, syncError: null };
  } catch (error) {
    const syncError = error instanceof Error ? error.message : "Synchronisation Google impossible.";
    await upsertGoogleConnection({
      merchant_id: merchant.id,
      status: "connected",
      last_error: syncError
    }, merchant);
    return { imported: 0, syncError };
  }
}
