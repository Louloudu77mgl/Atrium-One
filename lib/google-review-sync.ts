import type { SupabaseClient } from "@supabase/supabase-js";
import { getFreshGoogleAccessToken } from "@/lib/google-tokens";
import { upsertGoogleConnection } from "@/lib/google-connections";
import { getStoredGoogleReviewIndex, saveStoredGoogleReviewIndex } from "@/lib/automation-execution-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, GoogleConnectionRow, MerchantRow, ReviewRow } from "@/lib/supabase/types";

type GoogleReview = {
  name?: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string };
};

type ReviewsResponse = {
  reviews?: GoogleReview[];
  nextPageToken?: string;
  error?: {
    message?: string;
    details?: Array<{
      reason?: string;
      metadata?: {
        service?: string;
      };
    }>;
  };
};

const ratings: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export async function syncGoogleBusinessReviews(
  connection: GoogleConnectionRow,
  merchant: MerchantRow,
  databaseClient?: SupabaseClient<Database>
) {
  if (!connection.google_location_id?.startsWith("accounts/")) {
    throw new Error("Identifiant de fiche Google incomplet. Reconnectez la fiche pour lancer la synchronisation réelle.");
  }

  const accessToken = await getFreshGoogleAccessToken(connection, merchant, databaseClient);
  const supabase = databaseClient ?? await createServerSupabaseClient();
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
    const data = (await response.json()) as ReviewsResponse;

    if (!response.ok) {
      const message = data.error?.message ?? "Impossible d’importer les avis Google Business.";
      const serviceDisabled = data.error?.details?.some((detail) =>
        detail.reason === "SERVICE_DISABLED" || detail.metadata?.service === "mybusiness.googleapis.com"
      );

      if (serviceDisabled) {
        throw new Error("L’API des avis Google Business (mybusiness.googleapis.com) est désactivée dans le projet Google Cloud 650116804104.");
      }

      if (response.status === 429 || message.toLowerCase().includes("quota exceeded") || message.toLowerCase().includes("requests per minute")) {
        throw new Error("Google limite temporairement l’import des avis. Attendez 1 à 2 minutes puis relancez la synchronisation.");
      }
      throw new Error(message);
    }

    for (const review of data.reviews ?? []) {
      if (!review.name) continue;
      const rating = ratings[review.starRating ?? ""] ?? 3;
      const storedIndex = await getStoredGoogleReviewIndex(merchant.id, review.name).catch(() => null);
      const indexedReview = storedIndex?.local_review_id
        ? await findReviewById(supabase, merchant.id, storedIndex.local_review_id)
        : null;
      const existing = indexedReview ?? await findExistingGoogleReview({
          supabase,
          merchantId: merchant.id,
          sourceReviewId: review.name,
          createdAt: review.createTime
        });
      const reviewText = cleanGoogleReviewText(review.comment) || "Avis sans commentaire";
      const fullPayload = {
        merchant_id: merchant.id,
        author_name: review.reviewer?.isAnonymous ? "Client Google" : review.reviewer?.displayName ?? "Client Google",
        rating,
        review_text: reviewText,
        content: reviewText === "Avis sans commentaire" ? null : reviewText,
        source: "google",
        source_review_id: review.name,
        status: review.reviewReply?.comment
          ? "repondu" as const
          : existing?.status ?? (rating <= 2 ? "urgent" as const : "a_traiter" as const),
        sentiment: rating >= 4 ? "positif" as const : rating <= 2 ? "negatif" as const : "neutre" as const,
        created_at: review.createTime ?? new Date().toISOString(),
        updated_at: review.updateTime ?? review.createTime ?? new Date().toISOString()
      };
      const result = existing?.id
        ? await writeGoogleReview({ supabase, reviewId: existing.id, payload: fullPayload })
        : await writeGoogleReview({ supabase, payload: fullPayload });
      if (result.error) throw new Error(result.error.message);
      const localReviewId = result.id ?? existing?.id;
      if (!localReviewId) throw new Error("L’avis Google a été enregistré sans identifiant local.");
      await saveStoredGoogleReviewIndex(merchant.id, {
        source_review_id: review.name,
        local_review_id: localReviewId,
        create_time: review.createTime ?? null,
        update_time: review.updateTime ?? review.createTime ?? null,
        has_reply: Boolean(review.reviewReply?.comment)
      });
      if (!existing) imported += 1;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  await upsertGoogleConnection({
    merchant_id: merchant.id,
    access_token_encrypted: accessToken,
    last_sync_at: new Date().toISOString(),
    last_error: null,
    status: "connected"
  }, merchant, databaseClient);

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
    .select("id, status")
    .eq("merchant_id", merchantId)
    .eq("source_review_id", sourceReviewId)
    .limit(20);

  if (!bySourceReviewId.error) {
    return collapseDuplicateReviews(supabase, bySourceReviewId.data ?? []);
  }

  if (!isMissingColumnError(bySourceReviewId.error.message) || !createdAt) {
    throw new Error(bySourceReviewId.error.message);
  }

  const byCreatedAt = await supabase
    .from("reviews")
    .select("id, status")
    .eq("merchant_id", merchantId)
    .eq("created_at", createdAt)
    .limit(20);

  if (byCreatedAt.error) throw new Error(byCreatedAt.error.message);
  return collapseDuplicateReviews(supabase, byCreatedAt.data ?? []);
}

async function collapseDuplicateReviews(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  reviews: Array<{ id: string; status: ReviewRow["status"] }>
) {
  if (!reviews.length) return null;
  if (reviews.length === 1) return reviews[0];

  const statusPriority = ["published_auto", "published_manual", "published", "repondu", "generated", "ready_to_publish", "validation_required", "urgent", "a_traiter"];
  const sorted = [...reviews].sort((left, right) => {
    const leftPriority = statusPriority.indexOf(left.status ?? "");
    const rightPriority = statusPriority.indexOf(right.status ?? "");
    return (leftPriority < 0 ? statusPriority.length : leftPriority) - (rightPriority < 0 ? statusPriority.length : rightPriority);
  });
  const kept = sorted[0];
  const duplicateIds = sorted.slice(1).map((review) => review.id);
  const replyMove = await supabase.from("generated_replies").update({ review_id: kept.id }).in("review_id", duplicateIds);
  if (replyMove.error && !replyMove.error.message.toLowerCase().includes("does not exist")) {
    throw new Error(replyMove.error.message);
  }
  const deletion = await supabase.from("reviews").delete().in("id", duplicateIds);
  if (deletion.error) throw new Error(deletion.error.message);
  return kept;
}

async function findReviewById(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  merchantId: string,
  reviewId: string
) {
  const result = await supabase
    .from("reviews")
    .select("id, status")
    .eq("merchant_id", merchantId)
    .eq("id", reviewId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
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
    ? await reviewsTable.update(payload).eq("id", reviewId).select("id").maybeSingle()
    : await reviewsTable.insert(payload).select("id").single();

  if (!result.error || !isMissingColumnError(result.error.message)) {
    return { id: result.data?.id ?? reviewId, error: result.error };
  }

  const {
    content: _content,
    source: _source,
    source_review_id: _sourceReviewId,
    updated_at: _updatedAt,
    ...fallbackPayload
  } = payload;

  const fallback = reviewId
    ? await reviewsTable.update(fallbackPayload).eq("id", reviewId).select("id").maybeSingle()
    : await reviewsTable.insert(fallbackPayload).select("id").single();
  return { id: fallback.data?.id ?? reviewId, error: fallback.error };
}

export function cleanGoogleReviewText(value?: string) {
  if (!value) return "";
  return value
    .replace(/\n{2,}\s*\(?(?:translated by google|traduit par google)\)?[\s\S]*$/i, "")
    .replace(/\n{2,}\s*(?:original|texte d’origine)\s*[:：][\s\S]*$/i, "")
    .trim();
}

function isMissingColumnError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("schema cache") ||
    lower.includes("could not find") && lower.includes("column") ||
    lower.includes("column") && lower.includes("does not exist");
}

type ReviewInsertPayload = Pick<ReviewRow, "merchant_id" | "author_name" | "rating" | "review_text" | "sentiment"> &
  Partial<Pick<ReviewRow, "content" | "source" | "source_review_id" | "status" | "created_at" | "updated_at">>;
