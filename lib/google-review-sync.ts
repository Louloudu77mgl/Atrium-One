import { getFreshGoogleAccessToken } from "@/lib/google-tokens";
import { upsertGoogleConnection } from "@/lib/google-connections";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GoogleConnectionRow, MerchantRow, ReviewRow } from "@/lib/supabase/types";

type GoogleReview = {
  name?: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string };
};

type ReviewsResponse = { reviews?: GoogleReview[]; nextPageToken?: string };

const ratings: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export async function syncGoogleBusinessReviews(connection: GoogleConnectionRow, merchant: MerchantRow) {
  if (!connection.google_location_id?.startsWith("accounts/")) {
    throw new Error("Identifiant de fiche Google incomplet. Reconnectez la fiche pour lancer la synchronisation réelle.");
  }

  const accessToken = await getFreshGoogleAccessToken(connection, merchant);
  const supabase = await createServerSupabaseClient();
  let pageToken: string | undefined;
  let imported = 0;

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${connection.google_location_id}/reviews`);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    const data = (await response.json()) as ReviewsResponse & { error?: { message?: string } };

    if (!response.ok) {
      const message = data.error?.message ?? "Impossible d’importer les avis Google Business.";
      if (response.status === 429 || message.toLowerCase().includes("quota exceeded") || message.toLowerCase().includes("requests per minute")) {
        throw new Error("Google limite temporairement l’import des avis. Attendez 1 à 2 minutes puis relancez la synchronisation.");
      }
      throw new Error(message);
    }

    for (const review of data.reviews ?? []) {
      if (!review.name) continue;
      const rating = ratings[review.starRating ?? ""] ?? 3;
      const existing = await findExistingGoogleReview({
        supabase,
        merchantId: merchant.id,
        sourceReviewId: review.name,
        createdAt: review.createTime
      });
      const fullPayload = {
        merchant_id: merchant.id,
        author_name: review.reviewer?.isAnonymous ? "Client Google" : review.reviewer?.displayName ?? "Client Google",
        rating,
        review_text: review.comment?.trim() || "Avis sans commentaire",
        content: review.comment?.trim() || null,
        source: "google",
        source_review_id: review.name,
        status: review.reviewReply?.comment ? "repondu" as const : rating <= 2 ? "urgent" as const : "a_traiter" as const,
        sentiment: rating >= 4 ? "positif" as const : rating <= 2 ? "negatif" as const : "neutre" as const,
        created_at: review.createTime ?? new Date().toISOString(),
        updated_at: review.updateTime ?? review.createTime ?? new Date().toISOString()
      };
      const result = existing?.id
        ? await writeGoogleReview({ supabase, reviewId: existing.id, payload: fullPayload })
        : await writeGoogleReview({ supabase, payload: fullPayload });
      if (result.error) throw new Error(result.error.message);
      imported += 1;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  await upsertGoogleConnection({
    merchant_id: merchant.id,
    access_token_encrypted: accessToken,
    last_sync_at: new Date().toISOString(),
    last_error: null,
    status: "connected"
  }, merchant);

  return imported;
}

async function findExistingGoogleReview({
  supabase,
  merchantId,
  sourceReviewId,
  createdAt
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  merchantId: string;
  sourceReviewId: string;
  createdAt?: string;
}) {
  const bySourceReviewId = await supabase
        .from("reviews")
        .select("id")
    .eq("merchant_id", merchantId)
        .eq("source", "google")
    .eq("source_review_id", sourceReviewId)
        .maybeSingle();

  if (!bySourceReviewId.error) {
    return bySourceReviewId.data;
  }

  if (!isSchemaCacheError(bySourceReviewId.error.message) || !createdAt) {
    throw new Error(bySourceReviewId.error.message);
  }

  const byCreatedAt = await supabase
    .from("reviews")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("source", "google")
    .eq("created_at", createdAt)
    .maybeSingle();

  if (byCreatedAt.error) throw new Error(byCreatedAt.error.message);
  return byCreatedAt.data;
}

async function writeGoogleReview({
  supabase,
  reviewId,
  payload
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  reviewId?: string;
  payload: ReviewInsertPayload;
}) {
  const reviewsTable = supabase.from("reviews");
  const result = reviewId
    ? await reviewsTable.update(payload).eq("id", reviewId)
    : await reviewsTable.insert(payload);

  if (!result.error || !isSchemaCacheError(result.error.message)) {
    return result;
  }

  const { source_review_id: _sourceReviewId, ...fallbackPayload } = payload;

  return reviewId
    ? await reviewsTable.update(fallbackPayload).eq("id", reviewId)
    : await reviewsTable.insert(fallbackPayload);
}

function isSchemaCacheError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("could not find") && lower.includes("column");
}

type ReviewInsertPayload = Pick<ReviewRow, "merchant_id" | "author_name" | "rating" | "review_text" | "sentiment"> &
  Partial<Pick<ReviewRow, "content" | "source" | "source_review_id" | "status" | "created_at" | "updated_at">>;
