import type { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleConnection, upsertGoogleConnection } from "@/lib/google-connections";
import { syncGoogleBusinessReviews } from "@/lib/google-review-sync";
import { runReviewAutomationsForMerchant } from "@/lib/review-automation-runner";
import { getOrRefreshReviewInsights } from "@/lib/review-insights-server";
import { mapReviewRow } from "@/lib/reviews";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, GoogleConnectionRow, MerchantRow } from "@/lib/supabase/types";
import { hasBusinessFeatureAccessAdmin } from "@/lib/crm/access";

const AUTO_SYNC_MAX_AGE_MS = 10 * 60 * 1000;

export type GoogleReviewSyncResult = {
  attempted: boolean;
  imported: number;
  error: string | null;
};

export async function syncGoogleReviewsIfStale({
  connection,
  merchant,
  force = false,
  databaseClient
}: {
  connection: GoogleConnectionRow | null;
  merchant: MerchantRow;
  force?: boolean;
  databaseClient?: SupabaseClient<Database>;
}): Promise<GoogleReviewSyncResult> {
  if (!await hasBusinessFeatureAccessAdmin(merchant.id, "reviews")) return { attempted: false, imported: 0, error: null };
  if (!connection || connection.status !== "connected" || !connection.google_location_id) {
    return { attempted: false, imported: 0, error: null };
  }

  const latestAttempt = connection.last_sync_at ?? connection.connected_at;
  const isFresh = latestAttempt && Date.now() - new Date(latestAttempt).getTime() < AUTO_SYNC_MAX_AGE_MS;
  if (!force && isFresh) {
    return { attempted: false, imported: 0, error: null };
  }

  try {
    const imported = await syncGoogleBusinessReviews(connection, merchant, databaseClient);
    await runReviewAutomationsForMerchant(merchant.id, 5);
    const supabase = databaseClient ?? createSupabaseAdminClient();
    const { data: reviewRows, error: reviewsError } = await supabase
      .from("reviews")
      .select("*")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      throw new Error(reviewsError.message);
    }

    await getOrRefreshReviewInsights(
      merchant,
      (reviewRows ?? []).map((review, index) => mapReviewRow(review, index)),
      supabase
    );
    return { attempted: true, imported, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronisation Google impossible.";
    await upsertGoogleConnection({
      merchant_id: merchant.id,
      status: "connected",
      last_error: message
    }, merchant, databaseClient).catch(() => null);
    return { attempted: true, imported: 0, error: message };
  }
}

export async function syncAllConnectedGoogleReviews(limit = 20) {
  const supabase = createSupabaseAdminClient();
  const { data: connections, error: connectionsError } = await supabase
    .from("google_connections")
    .select("*")
    .eq("status", "connected")
    .not("google_location_id", "is", null)
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (connectionsError) throw new Error(connectionsError.message);
  if (!connections?.length) return [];

  const merchantIds = Array.from(new Set(connections.map((connection) => connection.merchant_id)));
  const { data: merchants, error: merchantsError } = await supabase
    .from("merchants")
    .select("*")
    .in("id", merchantIds);

  if (merchantsError) throw new Error(merchantsError.message);
  const merchantById = new Map((merchants ?? []).map((merchant) => [merchant.id, merchant]));
  const results: Array<{ merchantId: string; imported: number; error: string | null }> = [];

  for (const connection of connections) {
    const merchant = merchantById.get(connection.merchant_id);
    if (!merchant) {
      results.push({ merchantId: connection.merchant_id, imported: 0, error: "Commerce introuvable." });
      continue;
    }

    const result = await syncGoogleReviewsIfStale({
      connection,
      merchant,
      force: true,
      databaseClient: supabase
    });
    results.push({ merchantId: merchant.id, imported: result.imported, error: result.error });
  }

  return results;
}

export async function getGoogleConnectionWithAutoSync(merchant: MerchantRow) {
  const connection = await getGoogleConnection(merchant);
  const result = await syncGoogleReviewsIfStale({ connection, merchant });

  if (!result.attempted) return connection;
  return getGoogleConnection(merchant);
}
