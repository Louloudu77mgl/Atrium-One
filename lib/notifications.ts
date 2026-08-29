import type { Review } from "@/lib/mock-data";
import type { GoogleConnectionRow } from "@/lib/supabase/types";
import { getReviewCountersFromReviews } from "@/lib/review-counters";

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  type: "reviews" | "urgent" | "validation" | "google" | "hans";
  href: string;
  actionLabel: string;
};

export function getAppNotifications(reviews: Review[], googleConnection?: GoogleConnectionRow | null): AppNotification[] {
  const counters = getReviewCountersFromReviews(reviews);
  const googleConnected = googleConnection?.status === "connected";
  const notifications: AppNotification[] = [];

  if (counters.urgent > 0) {
    notifications.push({
      id: "urgent-reviews",
      title: `${counters.urgent} avis négatif${counters.urgent > 1 ? "s" : ""} à traiter`,
      description: "Répondez vite aux clients insatisfaits pour limiter l'impact réputation.",
      type: "urgent",
      href: "/reviews?filter=urgent",
      actionLabel: "Voir les urgents"
    });
  }

  const missingReplies = reviews.filter((review) =>
    ["a_traiter", "a-traiter", "urgent"].includes(review.status) &&
    !review.generatedReply &&
    !review.generatedReplyId
  ).length;

  if (missingReplies > 0) {
    notifications.push({
      id: "pending-reviews",
      title: `${missingReplies} avis à traiter`,
      description: "Hans peut générer une réponse courte et adaptée pour chacun.",
      type: "reviews",
      href: "/reviews?filter=pending",
      actionLabel: "Générer"
    });
  }

  if (counters.generated > 0 || counters.readyToPublish > 0) {
    notifications.push({
      id: "generated-replies",
      title: `${counters.generated + counters.readyToPublish} réponse${counters.generated + counters.readyToPublish > 1 ? "s" : ""} à relire`,
      description: "Relisez les réponses générées avant publication ou validation.",
      type: "validation",
      href: "/reviews?filter=ready",
      actionLabel: "Valider"
    });
  }

  if (counters.readyToPublish > 0) {
    notifications.push({
      id: "ready-to-publish",
      title: `${counters.readyToPublish} réponse${counters.readyToPublish > 1 ? "s" : ""} prête${counters.readyToPublish > 1 ? "s" : ""} à publier`,
      description: googleConnected ? "Publiez maintenant vos réponses sur votre fiche Google." : "Connectez votre fiche Google pour publier vos réponses.",
      type: "google",
      href: googleConnected ? "/reviews?filter=ready" : "/integrations",
      actionLabel: googleConnected ? "Publier" : "Connecter"
    });
  }

  if (notifications.length === 0) {
    notifications.push({
      id: "all-clear",
      title: "Aucune action urgente",
      description: "Tous les avis importants sont traités pour le moment.",
      type: "hans",
      href: "/dashboard",
      actionLabel: "Dashboard"
    });
  }

  return notifications;
}
