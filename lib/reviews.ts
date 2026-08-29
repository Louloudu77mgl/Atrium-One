import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/mock-data";
import type { GeneratedReplyRow, MerchantRow, ReviewRow } from "@/lib/supabase/types";

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

export function mapReviewRow(row: ReviewRow, index = 0, reply?: GeneratedReplyRow): Review {
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

export async function getReviews(currentMerchant?: MerchantRow | null): Promise<Review[]> {
  const merchant = currentMerchant ?? await getMerchant();

  if (!merchant) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table")) {
      return [];
    }

    throw new Error(error.message);
  }

  const reviewIds = data.map((review) => review.id);

  if (reviewIds.length === 0) {
    return [];
  }

  const { data: replies, error: repliesError } = await supabase
    .from("generated_replies")
    .select("*")
    .in("review_id", reviewIds)
    .in("status", ["generated", "selected", "approved", "validation_required", "published", "published_auto", "published_manual", "blocked_by_safety"])
    .order("created_at", { ascending: false });

  if (repliesError) {
    if (repliesError.message.includes("Could not find the table")) {
      return data.map((review, index) => mapReviewRow(review, index));
    }

    throw new Error(repliesError.message);
  }

  const repliesByReviewId = new Map<string, GeneratedReplyRow>();

  replies.forEach((reply) => {
    if (!repliesByReviewId.has(reply.review_id)) {
      repliesByReviewId.set(reply.review_id, reply);
    }
  });

  return data.map((review, index) => mapReviewRow(review, index, repliesByReviewId.get(review.id)));
}
