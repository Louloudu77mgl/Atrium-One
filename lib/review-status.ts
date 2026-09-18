import type { Review } from "@/lib/mock-data";
import { hasReviewComment, isNegativeRating } from "@/lib/review-rules";

export const actionableReviewStatuses = ["a_traiter", "a-traiter", "generated", "ready_to_publish", "validation_required", "blocked_by_safety", "urgent"] as const;
export const closedReviewStatuses = ["repondu", "ignored", "published", "published_auto", "published_manual"] as const;
export const urgentKeywords = [
  "retard",
  "déçu",
  "déçue",
  "remboursement",
  "problème",
  "mauvais",
  "nul",
  "catastrophe",
  "jamais",
  "honte",
  "mécontent",
  "mécontente"
] as const;

export function isActionableReviewStatus(status: Review["status"] | string | null | undefined) {
  return actionableReviewStatuses.includes((status ?? "a_traiter") as (typeof actionableReviewStatuses)[number]);
}

export function countActionableReviews(reviews: Review[]) {
  return reviews.filter((review) => hasReviewComment(review.text) && isActionableReviewStatus(review.status)).length;
}

export function canGenerateReply(review: Review) {
  const hasActiveReply =
    Boolean(review.generatedReply || review.generatedReplyId) &&
    ["generated", "selected", "approved", "published"].includes(review.generatedReplyStatus ?? "generated");

  return hasReviewComment(review.text) && ["a_traiter", "a-traiter", "urgent", "validation_required", "blocked_by_safety"].includes(review.status) && !hasActiveReply;
}

export function isClosedReviewStatus(status: Review["status"] | string | null | undefined) {
  return closedReviewStatuses.includes((status ?? "") as (typeof closedReviewStatuses)[number]);
}

export function containsUrgentKeyword(text: string | null | undefined) {
  const normalizedText = (text ?? "").toLowerCase();
  return urgentKeywords.some((keyword) => normalizedText.includes(keyword));
}

export function isUrgentReview(review: Pick<Review, "rating" | "sentiment" | "status" | "text">) {
  if (isClosedReviewStatus(review.status)) {
    return false;
  }

  return hasReviewComment(review.text) && isNegativeRating(review.rating);
}

export function isNegativeReview(review: Pick<Review, "rating">) {
  return isNegativeRating(review.rating);
}

export function analyzeReviewForTesting({
  rating,
  text
}: {
  rating: number;
  text: string;
}): Pick<Review, "sentiment" | "status"> {
  const sentiment: Review["sentiment"] = isNegativeRating(rating) ? "negatif" : "positif";

  return {
    sentiment,
    status: isNegativeRating(rating) ? "urgent" : "a_traiter"
  };
}
