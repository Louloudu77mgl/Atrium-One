import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Review } from "@/lib/mock-data";
import type { Database, GeneratedReplyRow, MerchantRow, ReviewRow } from "@/lib/supabase/types";

type ReviewListRow = Pick<
  ReviewRow,
  "id" | "author_name" | "rating" | "review_text" | "status" | "sentiment" | "created_at" | "updated_at"
>;

type GeneratedReplyListRow = Pick<
  GeneratedReplyRow,
  "id" | "review_id" | "generated_text" | "reply_text" | "status" | "is_edited" | "created_at"
>;

function normalizeStatus(status: string | null | undefined): Review["status"] {
  switch (status) {
    case "urgent":
    case "repondu":
    case "generated":
    case "ready_to_publish":
    case "validation_required":
    case "published":
    case "published_auto":
    case "published_manual":
    case "blocked_by_safety":
    case "ignored":
      return status;
    case "a_traiter":
    case "a-traiter":
      return "a_traiter";
    default:
      return "a_traiter";
  }
}

function normalizeSentiment(sentiment: string | null | undefined): Review["sentiment"] {
  switch (sentiment) {
    case "positif":
    case "neutre":
    case "negatif":
      return sentiment;
    default:
      return "neutre";
  }
}

function initials(authorName: string) {
  return authorName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function dateLabel(createdAt: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(createdAt));
}

export function mapReviewRow(row: ReviewListRow, index = 0, reply?: GeneratedReplyListRow): Review {
  const colors: Review["avatarColor"][] = ["red", "green", "amber", "gray", "navy"];

  return {
    id: row.id,
    author: row.author_name,
    initials: initials(row.author_name),
    avatarColor: colors[index % colors.length],
    rating: row.rating,
    date: dateLabel(row.created_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    status: normalizeStatus(row.status),
    sentiment: normalizeSentiment(row.sentiment),
    text: row.review_text,
    generatedReply: reply?.reply_text,
    generatedReplyId: reply?.id,
    generatedReplyStatus: reply?.status,
    generatedText: reply?.generated_text ?? undefined,
    isReplyEdited: reply?.is_edited,
    replyCreatedAt: reply?.created_at,
    publishedAt: reply?.status === "published" ? dateLabel(reply.created_at) : undefined
  };
}

export async function getReviews(currentMerchant?: MerchantRow | null, client?: SupabaseClient<Database>): Promise<Review[]> {
  const merchant = currentMerchant ?? await getMerchant();

  if (!merchant) {
    return [];
  }

  const supabase = client ?? await createServerSupabaseClient();
  let { data, error } = await supabase
    .from("reviews")
    .select("id,author_name,rating,review_text,status,sentiment,created_at,updated_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  // Some deployed databases predate the optional updated_at migration.
  // Keep the narrow projection without requiring a database migration to render.
  if (error?.code === "42703" && error.message.includes("reviews.updated_at")) {
    const legacy = await supabase
      .from("reviews")
      .select("id,author_name,rating,review_text,status,sentiment,created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false });
    data = legacy.data?.map((review) => ({ ...review, updated_at: review.created_at })) ?? null;
    error = legacy.error;
  }

  if (error) {
    if (error.message.includes("Could not find the table")) {
      return [];
    }

    throw new Error(error.message);
  }

  if (!data?.length) {
    return [];
  }

  const reviewIds = data.map((review) => review.id);

  const { data: replies, error: repliesError } = await supabase
    .from("generated_replies")
    .select("id,review_id,generated_text,reply_text,status,is_edited,created_at")
    .in("review_id", reviewIds)
    .in("status", ["generated", "selected", "approved", "validation_required", "published", "published_auto", "published_manual", "blocked_by_safety"])
    .order("created_at", { ascending: false });

  if (repliesError) {
    if (repliesError.message.includes("Could not find the table")) {
      return data.map((review, index) => mapReviewRow(review, index));
    }

    throw new Error(repliesError.message);
  }

  const repliesByReviewId = new Map<string, GeneratedReplyListRow>();

  replies.forEach((reply) => {
    if (!repliesByReviewId.has(reply.review_id)) {
      repliesByReviewId.set(reply.review_id, reply);
    }
  });

  return data.map((review, index) => mapReviewRow(review, index, repliesByReviewId.get(review.id)));
}

export async function getShellReviews(currentMerchant: MerchantRow): Promise<Review[]> {
  const supabase = await createServerSupabaseClient();
  const nested = await supabase
    .from("reviews")
    .select("id,rating,review_text,status,sentiment,generated_replies(id,status)")
    .eq("merchant_id", currentMerchant.id);

  let data: Array<{
    id: string;
    rating: number;
    review_text: string;
    status: ReviewRow["status"];
    sentiment: ReviewRow["sentiment"];
    generated_replies: Array<Pick<GeneratedReplyRow, "id" | "status">>;
  }> | null = nested.data;

  if (nested.error) {
    const fallback = await supabase
      .from("reviews")
      .select("id,rating,review_text,status,sentiment")
      .eq("merchant_id", currentMerchant.id);
    if (fallback.error) {
      if (fallback.error.message.includes("Could not find the table")) return [];
      throw new Error(fallback.error.message);
    }
    data = fallback.data.map((review) => ({ ...review, generated_replies: [] }));
  }

  if (!data?.length) return [];
  const activeReplyStatuses = new Set(["generated", "selected", "approved", "validation_required", "published", "published_auto", "published_manual", "blocked_by_safety"]);

  return data.map((review) => ({
    id: review.id,
    author: "",
    initials: "",
    avatarColor: "gray",
    rating: review.rating,
    date: "",
    status: normalizeStatus(review.status),
    sentiment: normalizeSentiment(review.sentiment),
    text: review.review_text,
    generatedReplyId: review.generated_replies.find((reply) => activeReplyStatuses.has(reply.status))?.id
  }));
}
