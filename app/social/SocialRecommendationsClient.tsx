import { SocialIdeasGrid } from "@/components/SocialIdeasGrid";
import type { ReviewSocialPostIdea } from "@/lib/review-insights";

export function SocialRecommendationsClient({ ideas }: { ideas: ReviewSocialPostIdea[] }) {
  return (
    <SocialIdeasGrid
      ideas={ideas}
      emptyTitle="Aucune recommandation disponible pour le moment"
      emptyDescription="Les prochaines recommandations seront préparées automatiquement lors de l’analyse quotidienne de 8 h."
      emptyHref="/reviews/insights"
      emptyLabel="Voir Insights IA"
    />
  );
}
