import type { Review } from "@/lib/mock-data";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { isUrgentReview } from "@/lib/review-status";

export type DynamicHansTask = {
  id: string;
  title: string;
  description: string;
  state: "todo" | "in_progress" | "done";
};

export function getDynamicHansRecommendations(reviews: Review[], googleConnected = false): DynamicHansTask[] {
  const counters = getReviewCountersFromReviews(reviews);
  const averageRating = counters.total > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / counters.total
    : 0;
  const tasks: DynamicHansTask[] = [];

  const firstUrgentReview = reviews.find(isUrgentReview);

  if (firstUrgentReview) {
    tasks.push({
      id: `urgent-${firstUrgentReview.id}`,
      title: `Répondre à l'avis de ${firstUrgentReview.author}`,
      description: `${counters.urgent} avis urgent${counters.urgent > 1 ? "s" : ""} attendent une réponse rassurante. Priorité : ${firstUrgentReview.rating}/5.`,
      state: "todo"
    });
  }

  const missingReplies = reviews.filter((review) =>
    ["a_traiter", "a-traiter", "urgent"].includes(review.status) &&
    !review.generatedReply &&
    !review.generatedReplyId
  ).length;

  if (missingReplies > 0) {
    tasks.push({
      id: "generate-missing-replies",
      title: missingReplies >= 10 ? "Réduire le délai de réponse" : "Générer les réponses manquantes",
      description: `${missingReplies} avis n'ont pas encore de réponse active préparée par Hans.`,
      state: counters.urgent > 0 ? "in_progress" : "todo"
    });
  }

  if (counters.generated > 0 || counters.readyToPublish > 0) {
    tasks.push({
      id: "approve-generated-replies",
      title: "Valider les réponses générées",
      description: `${counters.generated + counters.readyToPublish} réponse${counters.generated + counters.readyToPublish > 1 ? "s" : ""} doivent être relues ou publiées avec prudence.`,
      state: "todo"
    });
  }

  if (counters.readyToPublish > 0 && !googleConnected) {
    tasks.push({
      id: "connect-google-business",
      title: "Connecter Google Business pour publier les réponses",
      description: `${counters.readyToPublish} réponse${counters.readyToPublish > 1 ? "s sont" : " est"} validée${counters.readyToPublish > 1 ? "s" : ""} et prête${counters.readyToPublish > 1 ? "s" : ""} pour la future publication.`,
      state: "todo"
    });
  }

  if (averageRating > 0 && averageRating < 4) {
    tasks.push({
      id: "improve-average-rating",
      title: "Améliorer la satisfaction client",
      description: `La note moyenne est de ${averageRating.toFixed(1).replace(".", ",")}/5 : priorisez les réponses empathiques et les solutions concrètes.`,
      state: "in_progress"
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: "all-clear",
      title: "Tout est à jour.",
      description: "Hans n'a aucune recommandation prioritaire pour le moment.",
      state: "done"
    });
  }

  return tasks;
}
