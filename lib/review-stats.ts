import type { Kpi, Review } from "@/lib/mock-data";
import { getHansScore } from "@/lib/hans-score";

export function getReviewStats(reviews: Review[]) {
  const total = reviews.length;
  const answered = reviews.filter((review) => review.status === "repondu" || review.status === "published").length;
  const pending = reviews.filter((review) => ["a_traiter", "a-traiter", "urgent"].includes(review.status)).length;
  const generated = reviews.filter((review) => review.status === "generated" || review.generatedReplyStatus === "generated").length;
  const readyToPublish = reviews.filter((review) => review.status === "ready_to_publish" || review.generatedReplyStatus === "approved" || review.generatedReplyStatus === "selected").length;
  const averageRating = total > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;
  const positive = reviews.filter((review) => review.sentiment === "positif").length;
  const negative = reviews.filter((review) => review.sentiment === "negatif").length;
  const neutral = reviews.filter((review) => review.sentiment === "neutre").length;

  return {
    total,
    answered,
    pending,
    generated,
    readyToPublish,
    averageRating,
    positive,
    neutral,
    negative,
    sentimentLabel: positive >= negative && positive >= neutral ? "Positif" : negative > positive ? "À surveiller" : "Neutre"
  };
}

export function getKpisFromReviews(reviews: Review[]): Kpi[] {
  const stats = getReviewStats(reviews);
  const hansScore = getHansScore(reviews);

  return [
    {
      label: "Note moyenne",
      icon: "star",
      value: stats.total > 0 ? stats.averageRating.toFixed(1).replace(".", ",") : "—",
      unit: stats.total > 0 ? "/ 5" : undefined,
      subtext: stats.total > 0 ? `Calculée sur ${stats.total} avis` : "Aucun avis analysé",
      trend: stats.total > 0 && stats.averageRating < 4 ? "À surveiller" : "Stable",
      trendTone: stats.total > 0 && stats.averageRating < 4 ? "down" : "up"
    },
    {
      label: "Total des avis",
      icon: "message",
      value: String(stats.total),
      subtext: "Avis clients analysés",
      trend: stats.total > 0 ? `${stats.total} avis analysés` : "En attente d'avis",
      trendTone: stats.total > 0 ? "up" : "neutral"
    },
    {
      label: "À traiter",
      icon: "inbox",
      value: String(stats.pending),
      subtext: "Réponses à préparer",
      trend: stats.pending > 0 ? "Priorité" : "Tout est traité",
      trendTone: stats.pending > 0 ? "down" : "up",
      valueTone: stats.pending > 0 ? "danger" : "default",
      accent: stats.negative > 0 ? "red" : "purple"
    },
    {
      label: "Répondus",
      icon: "check",
      value: String(stats.answered),
      subtext: stats.total > 0 ? `${Math.round((stats.answered / stats.total) * 100)}% couverts` : "0% couverts",
      trend: stats.answered > 0 ? "En progression" : "À démarrer",
      trendTone: stats.answered > 0 ? "up" : "neutral"
    },
    {
      label: "Sentiment",
      icon: "chart",
      value: stats.sentimentLabel,
      subtext: `${stats.positive} positifs · ${stats.neutral} neutres`,
      trend: `${stats.negative} négatifs`,
      trendTone: stats.negative > stats.positive ? "down" : "up",
      compact: true
    },
    {
      label: "Négatifs",
      icon: "alert",
      value: String(stats.negative),
      subtext: "Avis à surveiller",
      trend: stats.negative > 0 ? "À prioriser" : "Aucun signal critique",
      trendTone: stats.negative > 0 ? "down" : "up",
      accent: stats.negative > 0 ? "red" : "green"
    },
    {
      label: "Prêts à publier",
      icon: "check",
      value: String(stats.readyToPublish),
      subtext: "En attente Google Business",
      trend: stats.readyToPublish > 0 ? "Validation OK" : "Aucune validation",
      trendTone: stats.readyToPublish > 0 ? "up" : "neutral",
      accent: "purple"
    },
    {
      label: "Score Hans",
      icon: "sparkle",
      value: String(hansScore.score),
      unit: "/100",
      subtext: `Réputation ${hansScore.label.toLowerCase()}`,
      trend: hansScore.score < 70 ? "À renforcer" : "Solide",
      trendTone: hansScore.score < 70 ? "down" : "up",
      accent: hansScore.score < 70 ? "amber" : "purple"
    }
  ];
}
