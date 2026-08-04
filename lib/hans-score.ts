import type { Review } from "@/lib/mock-data";
import { isUrgentReview } from "@/lib/review-status";

const positiveFallback = ["accueil", "professionnalisme", "qualité"];
const improvementFallback = ["délai", "prix", "disponibilité"];
const stopWords = new Set([
  "avec",
  "pour",
  "dans",
  "mais",
  "vous",
  "nous",
  "était",
  "avoir",
  "très",
  "plus",
  "bien",
  "tout",
  "rien",
  "chez",
  "faire",
  "merci",
  "leurs",
  "notre",
  "votre"
]);

export type HansScore = {
  score: number;
  label: "Excellent" | "Solide" | "À renforcer" | "Prioritaire";
  strengths: string[];
  improvements: string[];
  averageRating: number;
  totalReviews: number;
  negativeShare: number;
  starDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  explanation: string;
};

export function getHansScore(reviews: Review[]): HansScore {
  const total = reviews.length;
  const averageRating = total > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;
  const starDistribution = {
    1: reviews.filter((review) => review.rating === 1).length,
    2: reviews.filter((review) => review.rating === 2).length,
    3: reviews.filter((review) => review.rating === 3).length,
    4: reviews.filter((review) => review.rating === 4).length,
    5: reviews.filter((review) => review.rating === 5).length
  };
  const negativeReviews = reviews.filter((review) => review.rating <= 2 || review.sentiment === "negatif").length;
  const negativeShare = total > 0 ? negativeReviews / total : 0;
  const ratingComponent = total > 0 ? (averageRating / 5) * 70 : 0;
  const volumeComponent = total > 0 ? Math.min(15, Math.log10(total + 1) * 7.5) : 0;
  const distributionComponent = total > 0 ? ((starDistribution[4] + starDistribution[5]) / total) * 10 : 0;
  const negativePenalty = negativeShare * 25;
  const recentPenalty = reviews.filter(isUrgentReview).length > 0 ? Math.min(5, reviews.filter(isUrgentReview).length) : 0;
  const score = Math.max(0, Math.min(100, Math.round(ratingComponent + volumeComponent + distributionComponent - negativePenalty - recentPenalty)));

  return {
    score,
    label: score >= 85 ? "Excellent" : score >= 70 ? "Solide" : score >= 50 ? "À renforcer" : "Prioritaire",
    strengths: extractTerms(reviews, "positif", positiveFallback),
    improvements: extractTerms(reviews, "negatif", improvementFallback),
    averageRating,
    totalReviews: total,
    negativeShare,
    starDistribution,
    explanation: "Cette note est calculée à partir de la note moyenne, du volume d’avis et de la part d’avis négatifs."
  };
}

function extractTerms(reviews: Review[], sentiment: Review["sentiment"], fallback: string[]) {
  const words = reviews
    .filter((review) => review.sentiment === sentiment)
    .flatMap((review) => review.text.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿñæœ]+/i))
    .filter((word) => word.length > 4 && !stopWords.has(word));

  const counts = new Map<string, number>();
  words.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));

  const terms = [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 3)
    .map(([word]) => word);

  return terms.length > 0 ? terms : fallback;
}
