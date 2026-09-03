import type { ReviewSocialPostIdea } from "@/lib/review-insights";
import { badgeStyles } from "@/lib/design-system";

export function RecommendationSourceBadge({ idea }: { idea: ReviewSocialPostIdea }) {
  if (idea.localEvent || idea.seasonalMoment) {
    return <span className={badgeStyles.neutral}>{idea.localEvent ? "Événement local" : "Calendrier"}</span>;
  }
  if (idea.sourcePainPoint) return <span className={badgeStyles.danger}>Avis négatif · À améliorer</span>;
  if (idea.sourceStrength) return <span className={badgeStyles.success}>Avis positif · Point fort</span>;
  return null;
}
