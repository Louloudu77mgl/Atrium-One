import "server-only";

import type { Review } from "@/lib/mock-data";
import type { ReviewInsightsAnalysis, ReviewSocialPostIdea } from "@/lib/review-insights";
import { getUpcomingFrenchCommercialMoments } from "@/lib/social-calendar";
import { getUpcomingLocalSocialIdeas } from "@/lib/social-local-events";
import { getRecommendationOrigin, normalizeTheme, selectRecommendationMix, type RecommendationPost } from "@/lib/social-recommendation-shared";
import { getPreviouslyPublishedThemes } from "@/lib/social-recommendation-history";
import type { MerchantRow } from "@/lib/supabase/types";

export async function getTopSocialRecommendations({ analysis, merchant, posts = [], enrichWithExternalSources = true }: {
  analysis: ReviewInsightsAnalysis | null;
  reviews: Review[];
  merchant?: MerchantRow | null;
  posts?: RecommendationPost[];
  enrichWithExternalSources?: boolean;
}) {
  return getTopRecommendations({ analysis, merchant, posts, enrichWithExternalSources, contentType: "post" });
}

export async function getTopStoryRecommendations({ analysis, merchant, posts = [], enrichWithExternalSources = true }: {
  analysis: ReviewInsightsAnalysis | null;
  reviews: Review[];
  merchant?: MerchantRow | null;
  posts?: RecommendationPost[];
  enrichWithExternalSources?: boolean;
}) {
  return getTopRecommendations({ analysis, merchant, posts, enrichWithExternalSources, contentType: "story" });
}

async function getTopRecommendations({
  analysis,
  merchant,
  posts,
  enrichWithExternalSources,
  contentType
}: {
  analysis: ReviewInsightsAnalysis | null;
  merchant?: MerchantRow | null;
  posts: RecommendationPost[];
  enrichWithExternalSources: boolean;
  contentType: "post" | "story";
}) {
  const adapt = (ideas: ReviewSocialPostIdea[]) => contentType === "story" ? ideas.map(toStoryRecommendation) : ideas;
  const insightIdeas = adapt(buildInsightReserve(analysis));
  const [localIdeas, retired] = enrichWithExternalSources
    ? await Promise.all([
        merchant ? getUpcomingLocalSocialIdeas(merchant).then(adapt) : Promise.resolve([]),
        merchant ? getPreviouslyPublishedThemes(merchant.id, insightIdeas, posts) : Promise.resolve(new Set<string>())
      ])
    : [[], new Set<string>()];
  return selectRecommendationMix([insightIdeas.filter((idea) => !retired.has(getRecommendationOrigin(idea).themeKey)), localIdeas, adapt(buildSeasonalIdeas(merchant))], posts);
}

function toStoryRecommendation(idea: ReviewSocialPostIdea): ReviewSocialPostIdea {
  return {
    ...idea,
    platform: "instagram",
    contentType: "story",
    angle: `${idea.angle} Hans en fait une Story courte, immersive et immédiatement compréhensible.`,
    visualDirection: [
      idea.visualDirection,
      "Composition verticale 9:16 premium, un message unique, sujet fort, zones sûres Instagram et CTA lisible."
    ].filter(Boolean).join(" ")
  };
}

function buildInsightReserve(analysis: ReviewInsightsAnalysis | null): ReviewSocialPostIdea[] {
  if (!analysis) return [];
  const themes = [
    ...analysis.strengths.map((item) => ({ label: item.title, angle: item.communicationAngle, positive: true })),
    ...analysis.painPoints.map((item) => ({ label: item.title, angle: item.recommendation, positive: false }))
  ];
  const candidates: ReviewSocialPostIdea[] = (analysis.socialPostIdeas ?? []).flatMap((idea) => {
    if (idea.localEvent || idea.seasonalMoment) return [];
    const label = idea.sourcePainPoint || idea.sourceStrength;
    const theme = themes.find((item) => normalizeTheme(item.label) === normalizeTheme(label || ""));
    if (!theme) return [];
    return [{ ...idea, platform: "instagram", sourceStrength: theme.positive ? theme.label : undefined, sourcePainPoint: theme.positive ? undefined : theme.label }];
  });
  for (const theme of themes) {
    candidates.push({
      platform: "instagram",
      title: theme.positive ? `À découvrir : ${theme.label.toLowerCase()}` : `Nos conseils : ${theme.label.toLowerCase()}`,
      angle: theme.angle,
      sourceStrength: theme.positive ? theme.label : undefined,
      sourcePainPoint: theme.positive ? undefined : theme.label
    });
  }
  const positives = candidates.filter((idea) => idea.sourceStrength);
  const negatives = candidates.filter((idea) => idea.sourcePainPoint);
  return Array.from({ length: Math.max(positives.length, negatives.length) }).flatMap((_, index) => [positives[index], negatives[index]].filter(Boolean));
}

function buildSeasonalIdeas(merchant?: MerchantRow | null) {
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
  return getUpcomingFrenchCommercialMoments(new Date()).map((moment): ReviewSocialPostIdea => ({
    platform: "instagram",
    title: `${moment.shortLabel} à ${merchant?.city || "proximité"}`,
    angle: `Préparer un contenu utile avant le ${formatter.format(new Date(moment.date))}, adapté à ${merchant?.business_type?.toLowerCase() ?? "l'activité"}, sans inventer d'offre ni de participation à un événement.`,
    seasonalMoment: moment.label,
    eventDate: moment.date.slice(0, 10),
    category: merchant?.business_type ?? undefined
  }));
}
