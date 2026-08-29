import type { Review } from "@/lib/mock-data";
import { getSocialRecommendationsTargetCount } from "@/lib/review-insights";
import type { ReviewInsightsAnalysis, ReviewSocialPostIdea } from "@/lib/review-insights";
import { getUpcomingFrenchCommercialMoments } from "@/lib/social-calendar";
import { generateFreshSocialIdeas } from "@/lib/social-fresh-ideas";
import { getUpcomingLocalSocialIdeas } from "@/lib/social-local-events";
import type { MerchantRow, SocialPostRow } from "@/lib/supabase/types";

const visualDirections = [
  "Macro très rapprochée sur une matière ou un détail, avec profondeur de champ courte.",
  "Vue en plongée asymétrique, objets disposés comme une composition éditoriale.",
  "Plan large où le décor local et l'ambiance de la ville occupent une vraie place.",
  "Nature morte décentrée avec ombres graphiques et un accent de couleur franc.",
  "Perspective basse et dynamique avec un premier plan volontairement audacieux.",
  "Ambiance de fin de journée, lumière rasante et contraste doux mais profond.",
  "Composition minimaliste avec beaucoup d'espace négatif et un seul sujet fort.",
  "Scène de préparation prise sur le vif, geste naturel et mouvement suggéré.",
  "Mise en scène saisonnière élégante, sans accessoires clichés ni surcharge.",
  "Cadrage architectural jouant avec les lignes, vitrines, reflets et profondeur."
];

const stopWords = new Set(["avec", "dans", "pour", "vous", "votre", "notre", "chez", "plus", "post", "instagram", "client", "clients", "faire", "cette", "comme", "tout", "sans", "une", "des", "les", "sur"]);

function scoreIdea(idea: ReviewSocialPostIdea) {
  let score = 0;
  if (idea.sourcePainPoint) score += 5;
  if (idea.sourceStrength) score += 4;
  if (idea.localEvent) score += 2;
  if (idea.platform === "instagram") score += 1;
  score += Math.max(0, 80 - idea.title.length) / 80;
  return score;
}

export async function getTopSocialRecommendations({
  analysis,
  reviews,
  merchant,
  posts = []
}: {
  analysis: ReviewInsightsAnalysis | null;
  reviews: Review[];
  merchant?: MerchantRow | null;
  posts?: SocialPostRow[];
}) {
  const targetCount = Math.min(10, Math.max(5, getSocialRecommendationsTargetCount(reviews.length)));
  const publishedPosts = posts.filter((post) => post.status === "published");
  const insightIdeas = buildInsightIdeas(analysis, reviews).sort((left, right) => scoreIdea(right) - scoreIdea(left));
  const localIdeas = merchant && reviews.length < 5 ? await getUpcomingLocalSocialIdeas(merchant) : [];
  const seasonalIdeas = buildSeasonalIdeas(merchant);
  const evergreenIdeas = buildEvergreenIdeas(merchant);
  const unique: ReviewSocialPostIdea[] = [];

  for (const candidate of [...insightIdeas, ...localIdeas, ...seasonalIdeas, ...evergreenIdeas]) {
    const idea = { ...candidate, platform: "instagram" as const, visualDirection: candidate.visualDirection ?? visualDirections[unique.length % visualDirections.length] };
    if (isSimilarToPublished(idea, publishedPosts)) continue;
    if (unique.some((current) => similarityScore(ideaText(current), ideaText(idea)) >= 0.45)) continue;
    unique.push(idea);
    if (unique.length >= targetCount) break;
  }

  if (merchant && unique.length < targetCount) {
    const freshIdeas = await generateFreshSocialIdeas({ merchant, publishedPosts, existingIdeas: unique, count: targetCount - unique.length });
    for (const candidate of freshIdeas) {
      if (isSimilarToPublished(candidate, publishedPosts)) continue;
      if (unique.some((current) => similarityScore(ideaText(current), ideaText(candidate)) >= 0.45)) continue;
      unique.push(candidate);
      if (unique.length >= targetCount) break;
    }
  }

  return unique.slice(0, 10);
}

export function getStoredSocialRecommendations({
  analysis,
  posts = []
}: {
  analysis: ReviewInsightsAnalysis | null;
  posts?: SocialPostRow[];
}) {
  const publishedPosts = posts.filter((post) => post.status === "published");

  return (analysis?.socialPostIdeas ?? [])
    .filter((idea) => !isSimilarToPublished(idea, publishedPosts))
    .slice(0, 10);
}

export function buildCreatePostHref(idea: ReviewSocialPostIdea) {
  const params = new URLSearchParams({
    platform: "instagram",
    title: idea.title,
    angle: idea.angle,
    source: idea.sourcePainPoint ?? idea.sourceStrength ?? idea.localEvent ?? idea.seasonalMoment ?? "Activité du commerce"
  });
  if (idea.category) params.set("category", idea.category);
  if (idea.seasonalMoment) params.set("seasonalMoment", idea.seasonalMoment);
  if (idea.localEvent) params.set("localEvent", idea.localEvent);
  if (idea.eventDate) params.set("eventDate", idea.eventDate);
  if (idea.sourceUrl) params.set("sourceUrl", idea.sourceUrl);
  if (idea.visualDirection) params.set("visualDirection", idea.visualDirection);
  return `/social/create?${params.toString()}`;
}

function buildInsightIdeas(analysis: ReviewInsightsAnalysis | null, reviews: Review[]) {
  const ideas = [...(analysis?.socialPostIdeas ?? [])];
  for (const strength of analysis?.strengths ?? []) {
    ideas.push({ platform: "instagram" as const, title: `Pourquoi nos clients apprécient ${strength.title.toLowerCase()}`, angle: strength.communicationAngle, sourceStrength: strength.title });
  }
  for (const painPoint of analysis?.painPoints ?? []) {
    ideas.push({ platform: "instagram" as const, title: `Notre réponse concrète : ${painPoint.title.toLowerCase()}`, angle: painPoint.recommendation, sourcePainPoint: painPoint.title });
  }
  if (!ideas.length && reviews.length) {
    const positive = reviews.find((review) => review.rating >= 4) ?? reviews[0];
    ideas.push({ platform: "instagram", title: "Ce que nos clients retiennent vraiment", angle: "Mettre en scène un point concret apprécié par les clients, sans citer ni répondre directement à un avis.", sourceStrength: positive.text.slice(0, 100) });
  }
  return ideas;
}

function buildSeasonalIdeas(merchant?: MerchantRow | null) {
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
  return getUpcomingFrenchCommercialMoments(new Date()).map((moment): ReviewSocialPostIdea => ({
    platform: "instagram",
    title: `${moment.shortLabel} à ${merchant?.city || "proximité"}`,
    angle: `Préparer un contenu utile avant le ${formatter.format(new Date(moment.date))}, adapté à ${merchant?.business_type?.toLowerCase() ?? "l'activité"}, sans promotion artificielle.`,
    seasonalMoment: moment.label,
    eventDate: moment.date.slice(0, 10),
    category: merchant?.business_type ?? undefined
  }));
}

function buildEvergreenIdeas(merchant?: MerchantRow | null): ReviewSocialPostIdea[] {
  const activity = merchant?.business_type?.toLowerCase() || "commerce local";
  const city = merchant?.city || "votre ville";
  return [
    { title: "Le détail qui fait la différence", angle: `Montrer un détail précis du savoir-faire de ${activity}, avec une preuve visuelle plutôt qu'une promesse générique.` },
    { title: `Une adresse à connaître à ${city}`, angle: "Faire découvrir l'ambiance du lieu et son ancrage local avec un cadrage extérieur ou architectural original." },
    { title: "Dans les coulisses d'une préparation", angle: "Raconter une étape concrète de préparation à travers les gestes, les objets, les matières et le décor." },
    { title: "Le choix du moment", angle: `Mettre en avant une sélection de saison pertinente pour ${activity}, avec un conseil simple et immédiatement utile.` },
    { title: "Une question souvent posée", angle: "Répondre clairement à une question pratique des clients avec un visuel pédagogique, élégant et non surchargé." },
    { title: "Notre sélection locale", angle: `Créer une composition inspirée de ${city} et du quartier, reliée naturellement à l'activité du commerce.` },
    { title: "Avant et après le savoir-faire", angle: "Montrer une transformation, une évolution ou deux états d'un même produit sans recourir à un collage générique." },
    { title: "La texture de la semaine", angle: "Construire un post très visuel autour d'une matière, d'une couleur ou d'un détail sensoriel caractéristique de l'activité." },
    { title: "Le conseil de la maison", angle: "Partager une recommandation courte et experte que les clients peuvent appliquer ou retenir immédiatement." },
    { title: "Un moment simple à savourer", angle: "Mettre en scène un usage réel du produit ou du service dans une ambiance locale crédible et chaleureuse." }
  ].map((idea) => ({ platform: "instagram", ...idea, category: merchant?.business_type ?? undefined }));
}

function isSimilarToPublished(idea: ReviewSocialPostIdea, posts: SocialPostRow[]) {
  return posts.some((post) => similarityScore(ideaText(idea), `${post.title} ${post.caption}`) >= 0.38);
}

function ideaText(idea: ReviewSocialPostIdea) {
  return [idea.title, idea.angle, idea.sourcePainPoint, idea.sourceStrength, idea.localEvent, idea.seasonalMoment].filter(Boolean).join(" ");
}

function similarityScore(left: string, right: string) {
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => { if (rightTokens.has(token)) overlap += 1; });
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function meaningfulTokens(value: string) {
  return new Set(value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token.length >= 4 && !stopWords.has(token)).slice(0, 30));
}
