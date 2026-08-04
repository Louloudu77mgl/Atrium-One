import { SocialIdeasGrid } from "@/components/SocialIdeasGrid";
import type { ReviewSocialPostIdea } from "@/lib/review-insights";

export function SocialRecommendationsClient({ ideas }: { ideas: ReviewSocialPostIdea[] }) {
  return (
    <SocialIdeasGrid
      ideas={ideas}
      emptyTitle="Aucune recommandation disponible pour le moment"
      emptyDescription="Analysez davantage d’avis pour générer de nouvelles idées de posts."
      emptyHref="/reviews/insights"
      emptyLabel="Analyser mes avis"
    />
  );
}
