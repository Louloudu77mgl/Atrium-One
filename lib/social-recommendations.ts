import type { Review } from "@/lib/mock-data";
import { getSocialRecommendationsTargetCount } from "@/lib/review-insights";
import type { ReviewInsightsAnalysis, ReviewSocialPostIdea } from "@/lib/review-insights";
import { getUpcomingFrenchCommercialMoments } from "@/lib/social-calendar";
import type { MerchantRow } from "@/lib/supabase/types";

function scoreIdea(idea: ReviewSocialPostIdea) {
  let score = 0;
  if (idea.sourcePainPoint) score += 3;
  if (idea.sourceStrength) score += 2;
  if (idea.platform === "instagram") score += 1;
  score += Math.max(0, 80 - idea.title.length) / 80;
  return score;
}

export function getTopSocialRecommendations({
  analysis,
  reviews,
  merchant
}: {
  analysis: ReviewInsightsAnalysis | null;
  reviews: Review[];
  merchant?: MerchantRow | null;
}) {
  const targetCount = getSocialRecommendationsTargetCount(reviews.length);

  if (targetCount === 0) {
    return [];
  }

  const seededIdeas = (analysis?.socialPostIdeas ?? [])
    .slice()
    .sort((left, right) => scoreIdea(right) - scoreIdea(left));

  if (seededIdeas.length > 0) {
    const unique = new Map<string, ReviewSocialPostIdea>();

    seededIdeas.forEach((idea) => {
      const source = idea.sourcePainPoint ?? idea.sourceStrength ?? "avis";
      const key = `${idea.platform}-${idea.title.toLowerCase()}-${source.toLowerCase()}`;
      if (!unique.has(key)) {
        unique.set(key, idea);
      }
    });

    return withSeasonalIdeas([...unique.values()], merchant).slice(0, Math.max(targetCount, 6));
  }

  const fallbackIdeas: ReviewSocialPostIdea[] = [];

  for (const painPoint of analysis?.painPoints ?? []) {
    fallbackIdeas.push({
      platform: fallbackIdeas.length % 2 === 0 ? "instagram" : "facebook",
      title: `Conseil client: ${painPoint.title}`,
      angle: painPoint.recommendation,
      sourcePainPoint: painPoint.title
    });
  }

  for (const strength of analysis?.strengths ?? []) {
    fallbackIdeas.push({
      platform: fallbackIdeas.length % 2 === 0 ? "instagram" : "facebook",
      title: `Mettre en avant ${strength.title.toLowerCase()}`,
      angle: strength.communicationAngle,
      sourceStrength: strength.title
    });
  }

  if (fallbackIdeas.length === 0 && reviews.length > 0) {
    const firstPositive = reviews.find((review) => review.rating >= 4) ?? reviews[0];
    const firstNegative = reviews.find((review) => review.rating <= 2);

    fallbackIdeas.push({
      platform: "instagram",
      title: "Ce que nos clients retiennent",
      angle: "Transformer les retours clients en message simple et rassurant.",
      sourceStrength: firstPositive.text.slice(0, 72)
    });

    if (firstNegative) {
      fallbackIdeas.push({
        platform: "facebook",
        title: "Comment nous améliorons l'experience client",
        angle: "Montrer une action concrete prise a partir d'un avis.",
        sourcePainPoint: firstNegative.text.slice(0, 72)
      });
    }
  }

  const unique = new Map<string, ReviewSocialPostIdea>();

  [...seededIdeas, ...fallbackIdeas].forEach((idea) => {
    const source = idea.sourcePainPoint ?? idea.sourceStrength ?? "avis";
    const key = `${idea.platform}-${idea.title.toLowerCase()}-${source.toLowerCase()}`;
    if (!unique.has(key)) {
      unique.set(key, idea);
    }
  });

  return withSeasonalIdeas([...unique.values()], merchant).slice(0, Math.max(targetCount, 6));
}

export function buildCreatePostHref(idea: ReviewSocialPostIdea) {
  const params = new URLSearchParams({
    platform: idea.platform,
    title: idea.title,
    angle: idea.angle,
    source: idea.sourcePainPoint ?? idea.sourceStrength ?? idea.seasonalMoment ?? "Avis clients"
  });

  if (idea.category) params.set("category", idea.category);
  if (idea.seasonalMoment) params.set("seasonalMoment", idea.seasonalMoment);

  return `/social/create?${params.toString()}`;
}

function withSeasonalIdeas(
  ideas: ReviewSocialPostIdea[],
  merchant?: MerchantRow | null
) {
  const seasonalIdeas: ReviewSocialPostIdea[] = getUpcomingFrenchCommercialMoments(new Date()).map((moment) => ({
      platform: "instagram" as const,
      title: `${moment.shortLabel} : post à préparer`,
      angle: `Créer un post simple et vendeur pour ${moment.label.toLowerCase()}, adapté à ${merchant?.business_type?.toLowerCase() ?? "votre commerce"}.`,
      seasonalMoment: moment.label,
      category: merchant?.business_type ?? undefined
    }));

  const unique = new Map<string, ReviewSocialPostIdea>();

  [...ideas, ...seasonalIdeas].forEach((idea) => {
    const source = idea.sourcePainPoint ?? idea.sourceStrength ?? idea.seasonalMoment ?? "avis";
    const key = `${idea.platform}-${idea.title.toLowerCase()}-${source.toLowerCase()}`;
    if (!unique.has(key)) {
      unique.set(key, idea);
    }
  });

  return [...unique.values()];
}
