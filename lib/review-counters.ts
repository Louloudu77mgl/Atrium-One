import type { Review } from "@/lib/mock-data";
import { isClosedReviewStatus, isUrgentReview } from "@/lib/review-status";

export type ReviewCounters = {
  total: number;
  pending: number;
  urgent: number;
  generated: number;
  readyToPublish: number;
  answered: number;
  ignored: number;
};

export function getReviewCountersFromReviews(reviews: Review[]): ReviewCounters {
  return reviews.reduce<ReviewCounters>(
    (counters, review) => {
      counters.total += 1;

      if (review.status === "generated") {
        counters.generated += 1;
      }

      if (review.status === "ready_to_publish" || review.status === "validation_required" || review.status === "blocked_by_safety") {
        counters.readyToPublish += 1;
      }

      if (review.status === "repondu" || review.status === "published" || review.status === "published_auto" || review.status === "published_manual") {
        counters.answered += 1;
      }

      if (review.status === "ignored") {
        counters.ignored += 1;
      }

      if (!isClosedReviewStatus(review.status) && ["a_traiter", "a-traiter", "urgent", "generated", "ready_to_publish", "validation_required", "blocked_by_safety"].includes(review.status)) {
        counters.pending += 1;
      }

      if (isUrgentReview(review)) {
        counters.urgent += 1;
      }

      return counters;
    },
    {
      total: 0,
      pending: 0,
      urgent: 0,
      generated: 0,
      readyToPublish: 0,
      answered: 0,
      ignored: 0
    }
  );
}

export function getReviewCounters(_merchantId: string | null | undefined, reviews: Review[] = []) {
  return getReviewCountersFromReviews(reviews);
}
