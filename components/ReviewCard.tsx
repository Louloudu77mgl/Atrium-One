"use client";

import type { Review } from "@/lib/mock-data";
import { isUrgentReview } from "@/lib/review-status";
import { badgeStyles, buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";

const avatarClasses = {
  red: "bg-[var(--color-danger)]",
  green: "bg-[var(--color-primary)]",
  amber: "bg-[var(--color-warning)]",
  gray: "bg-[var(--color-text-soft)]",
  navy: "bg-[var(--color-primary-hover)]"
};

const defaultStatus = { label: "À traiter", pill: badgeStyles.neutral, border: "border-l-[var(--color-text-soft)]" };

const statusConfig: Record<string, { label: string; pill: string; border: string }> = {
  urgent: { label: "Urgent", pill: badgeStyles.danger, border: "border-l-[var(--color-danger)]" },
  "a-traiter": { label: "À traiter", pill: badgeStyles.warning, border: "border-l-[var(--color-warning)]" },
  a_traiter: { label: "À traiter", pill: badgeStyles.warning, border: "border-l-[var(--color-warning)]" },
  ready_to_publish: { label: "À valider", pill: badgeStyles.hans, border: "border-l-[var(--color-primary)]" },
  validation_required: { label: "Validation requise", pill: badgeStyles.warning, border: "border-l-[var(--color-warning)]" },
  generated: { label: "Réponse générée", pill: badgeStyles.hans, border: "border-l-[var(--color-primary)]" },
  blocked_by_safety: { label: "Bloquée par sécurité", pill: badgeStyles.danger, border: "border-l-[var(--color-danger)]" },
  published: { label: "Publiée", pill: badgeStyles.hans, border: "border-l-[var(--color-primary)]" },
  published_auto: { label: "Publiée automatiquement", pill: badgeStyles.hans, border: "border-l-[var(--color-primary)]" },
  published_manual: { label: "Publiée manuellement", pill: badgeStyles.hans, border: "border-l-[var(--color-primary)]" },
  repondu: { label: "Publiée", pill: badgeStyles.hans, border: "border-l-[var(--color-primary)]" },
  ignored: { label: "Ignoré", pill: badgeStyles.neutral, border: "border-l-[var(--color-text-soft)]" }
};

const defaultSentiment = { label: "Neutre", pill: badgeStyles.neutral };

const sentimentConfig: Record<string, { label: string; pill: string }> = {
  positif: { label: "Positif", pill: badgeStyles.hans },
  neutre: { label: "Neutre", pill: badgeStyles.neutral },
  negatif: { label: "Négatif", pill: badgeStyles.danger }
};

function normalizeStatus(status: Review["status"] | string | null | undefined) {
  if (status === "a-traiter") {
    return "a_traiter";
  }

  return status ?? "a_traiter";
}

function normalizeSentiment(sentiment: Review["sentiment"] | string | null | undefined) {
  return sentiment ?? "neutre";
}

function stars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export function ReviewCard({
  review,
  onGenerate,
  onViewReply,
  onPublish,
  busy = false
}: {
  review: Review;
  onGenerate: (review: Review) => void;
  onViewReply?: (review: Review) => void;
  onPublish?: (review: Review) => void;
  busy?: boolean;
}) {
  const normalizedStatus = normalizeStatus(review.status);
  const normalizedSentiment = normalizeSentiment(review.sentiment);
  const status = statusConfig[normalizedStatus] ?? defaultStatus;
  const sentiment = sentimentConfig[normalizedSentiment] ?? defaultSentiment;
  const isAnswered = ["repondu", "published", "published_auto", "published_manual"].includes(normalizedStatus);
  const hasReply = Boolean(review.generatedReply || review.generatedReplyId || isAnswered || ["generated", "ready_to_publish", "validation_required", "blocked_by_safety"].includes(normalizedStatus));
  const isUrgent = isUrgentReview(review);

  return (
    <article className={`ao-card overflow-hidden border-l-4 ${status.border} transition hover:shadow-[var(--shadow-card-hover)]`}>
      <div className="flex flex-col gap-3 px-[18px] pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClasses[review.avatarColor] ?? avatarClasses.navy}`}>
            {review.initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)]">{review.author}</div>
            <div className={`mt-0.5 ${typographyStyles.caption} text-[11px]`}>{review.date}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <span className={`${status.pill} px-2.5 py-1 text-[11px]`}>{status.label}</span>
          <span className={`${sentiment.pill} px-2.5 py-1 text-[11px]`}>{sentiment.label}</span>
        </div>
      </div>

      <div className="px-[18px] pb-3.5">
        <div className="mb-1.5 text-[13px] tracking-[1px] text-[var(--color-primary)]">{stars(review.rating)}</div>
        <p lang="fr" translate="no" className="notranslate text-[13.5px] leading-6 text-[var(--color-text-muted)]">{review.text}</p>
      </div>

      <div className={`flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-[18px] py-3 ${isAnswered ? "bg-[var(--color-primary-soft)]" : "bg-[var(--color-surface-subtle)]"}`}>
        {isAnswered ? (
          <>
            <span className="text-xs font-semibold text-[var(--color-primary)]">Réponse traitée avec Hans{review.publishedAt ? ` · ${review.publishedAt}` : ""}</span>
            <button type="button" onClick={() => onViewReply?.(review)} className={`ml-auto ${buttonStyles.tertiary} text-xs`}>
              Voir la réponse
            </button>
          </>
        ) : hasReply ? (
          <>
            <button type="button" onClick={() => onViewReply?.(review)} className={`${buttonStyles.primary} gap-1.5 px-3 py-1.5 text-xs`}>
              Modifier la réponse
            </button>
            {["ready_to_publish", "generated", "validation_required", "blocked_by_safety"].includes(normalizedStatus) ? (
              <button type="button" onClick={() => onPublish?.(review)} disabled={busy} className={`${buttonStyles.secondary} px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60`}>
                {busy ? "Traitement..." : normalizedStatus === "generated" ? "Valider" : "Ouvrir"}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onGenerate(review)}
              className={`${buttonStyles.primary} gap-1.5 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {busy ? "Réponse en cours..." : "Répondre"}
            </button>
            {isUrgent ? (
              <button type="button" className={`ml-auto ${buttonStyles.tertiary} px-3 py-1.5 text-xs`}>
                Ignorer
              </button>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
