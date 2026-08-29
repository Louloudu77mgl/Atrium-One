import type { Review } from "@/lib/mock-data";
import type { ReviewInsightRow } from "@/lib/supabase/types";

export type InsightFrequency = "faible" | "moyenne" | "élevée";
export type InsightLevel = "faible" | "moyen" | "élevé";
export type SocialPlatform = "instagram" | "facebook";
export type RecommendedActionChannel = "sms" | "social" | "rcu" | "reviews";

export type ReviewPainPoint = {
  title: string;
  frequency: InsightFrequency;
  summary: string;
  examples: string[];
  recommendation: string;
};

export type ReviewStrength = {
  title: string;
  summary: string;
  examples: string[];
  communicationAngle: string;
};

export type ReviewPriorityAction = {
  title: string;
  impact: InsightLevel;
  difficulty: InsightLevel | "facile" | "moyenne" | "difficile";
  description: string;
  channel: RecommendedActionChannel;
  strategyPoints: string[];
};

export type ReviewSocialPostIdea = {
  platform: SocialPlatform;
  title: string;
  angle: string;
  sourcePainPoint?: string;
  sourceStrength?: string;
  category?: string;
  seasonalMoment?: string;
  localEvent?: string;
  eventDate?: string;
  sourceUrl?: string;
  visualDirection?: string;
  assetUrl?: string;
  assetAltText?: string;
};

export type ReviewInsightsAnalysis = {
  painPoints: ReviewPainPoint[];
  strengths: ReviewStrength[];
  priorityActions: ReviewPriorityAction[];
  socialPostIdeas: ReviewSocialPostIdea[];
  reviewSnapshot?: {
    reviewsCount: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
  };
};

export const MIN_REVIEWS_FOR_SOCIAL_RECOMMENDATIONS = 5;
export const REVIEW_INSIGHTS_STORAGE_TITLE = "__atrium_review_insights_v1__";

export const emptyAnalysis: ReviewInsightsAnalysis = {
  painPoints: [],
  strengths: [],
  priorityActions: [],
  socialPostIdeas: []
};

export function getSocialRecommendationsTargetCount(reviewsCount: number) {
  if (reviewsCount >= 25) return 10;
  if (reviewsCount >= 15) return 8;
  if (reviewsCount >= MIN_REVIEWS_FOR_SOCIAL_RECOMMENDATIONS) return 6;
  return 5;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean).slice(0, 3)
    : [];
}

function asStrategyPoints(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => limitText(item, "", 180)).filter(Boolean).slice(0, 3)
    : [];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeaningfulTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 4)
    .slice(0, 6);
}

function reviewContainsSnippet(review: Review, snippet: string) {
  const normalizedReview = normalizeText(review.text);
  const normalizedSnippet = normalizeText(snippet);

  if (!normalizedSnippet || normalizedSnippet.length < 8) {
    return false;
  }

  return normalizedReview.includes(normalizedSnippet) || normalizedSnippet.includes(normalizedReview.slice(0, Math.min(normalizedReview.length, normalizedSnippet.length)));
}

function reviewMatchesTitleTokens(review: Review, title: string) {
  const normalizedReview = normalizeText(review.text);
  const tokens = extractMeaningfulTokens(title);

  if (tokens.length === 0) {
    return false;
  }

  const matched = tokens.filter((token) => normalizedReview.includes(token));
  return matched.length >= Math.min(2, tokens.length);
}

function getEvidenceExamples(examples: string[], reviews: Review[]) {
  return examples.filter((example) => reviews.some((review) => reviewContainsSnippet(review, example)));
}

function limitText(value: unknown, fallback: string, maxLength = 120) {
  const text = asString(value, fallback);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function normalizeFrequency(value: unknown): InsightFrequency {
  const normalized = asString(value, "moyenne").toLowerCase();

  if (normalized.startsWith("faible")) return "faible";
  if (normalized.startsWith("élev") || normalized.startsWith("elev")) return "élevée";
  return "moyenne";
}

function normalizeLevel(value: unknown): ReviewPriorityAction["impact"] {
  const normalized = asString(value, "moyen").toLowerCase();

  if (normalized.startsWith("faible")) return "faible";
  if (normalized.startsWith("élev") || normalized.startsWith("elev")) return "élevé";
  return "moyen";
}

function normalizeDifficulty(value: unknown): ReviewPriorityAction["difficulty"] {
  const normalized = asString(value, "facile").toLowerCase();

  if (normalized.startsWith("diff")) return "difficile";
  if (normalized.startsWith("moy")) return "moyenne";
  if (normalized.startsWith("élev") || normalized.startsWith("elev")) return "élevé";
  if (normalized.startsWith("faible")) return "faible";
  return "facile";
}

function normalizeActionChannel(value: unknown, fallbackIndex = 0): RecommendedActionChannel {
  const normalized = asString(value).toLowerCase();

  if (normalized.includes("sms")) return "sms";
  if (normalized.includes("social") || normalized.includes("instagram") || normalized.includes("réseau") || normalized.includes("reseau")) return "social";
  if (normalized.includes("rcu") || normalized.includes("client") || normalized.includes("fidél") || normalized.includes("fidel")) return "rcu";
  if (normalized.includes("avis") || normalized.includes("review") || normalized.includes("google")) return "reviews";

  return (["social", "reviews", "sms", "rcu"] as const)[fallbackIndex % 4];
}

function normalizePlatform(value: unknown): SocialPlatform {
  return asString(value).toLowerCase().includes("facebook") ? "facebook" : "instagram";
}

function asNonNegativeInteger(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : 0;
}

export function validateReviewInsights(raw: unknown): ReviewInsightsAnalysis {
  if (!raw || typeof raw !== "object") {
    return emptyAnalysis;
  }

  const source = raw as Record<string, unknown>;
  const painPoints = Array.isArray(source.painPoints)
    ? source.painPoints.map((item) => {
        const point = item as Record<string, unknown>;
        return {
          title: asString(point.title, "Douleur client détectée"),
          frequency: normalizeFrequency(point.frequency),
          summary: limitText(point.summary, "Plusieurs avis évoquent ce sujet."),
          examples: asStringArray(point.examples),
          recommendation: limitText(point.recommendation, "Transformer ce signal en action claire pour rassurer les clients.")
        };
      }).slice(0, 4)
    : [];

  const strengths = Array.isArray(source.strengths)
    ? source.strengths.map((item) => {
        const strength = item as Record<string, unknown>;
        return {
          title: asString(strength.title, "Point fort client"),
          summary: limitText(strength.summary, "Les avis soulignent régulièrement ce point positif."),
          examples: asStringArray(strength.examples),
          communicationAngle: limitText(strength.communicationAngle, "Valoriser ce point fort dans un post simple et rassurant.")
        };
      }).slice(0, 4)
    : [];

  const priorityActions = Array.isArray(source.priorityActions)
    ? source.priorityActions.map((item, index) => {
        const action = item as Record<string, unknown>;
        const description = limitText(action.description, "Une action simple peut améliorer l'expérience client et la communication.", 180);
        const strategyPoints = asStrategyPoints(action.strategyPoints ?? action.bullets);
        return {
          title: asString(action.title, "Action recommandée"),
          impact: normalizeLevel(action.impact),
          difficulty: normalizeDifficulty(action.difficulty),
          description,
          channel: normalizeActionChannel(action.channel, index),
          strategyPoints: strategyPoints.length > 0 ? strategyPoints : [description]
        };
      }).slice(0, 4)
    : [];

  const rawSocialPostIdeas = Array.isArray(source.socialPostIdeas)
    ? source.socialPostIdeas.map((item) => {
        const idea = item as Record<string, unknown>;
        return {
          platform: normalizePlatform(idea.platform),
          title: asString(idea.title, "Post recommandé à partir des avis"),
          angle: asString(idea.angle, "Transformer un insight client en contenu utile et rassurant."),
          sourcePainPoint: asString(idea.sourcePainPoint) || undefined,
          sourceStrength: asString(idea.sourceStrength) || undefined,
          category: asString(idea.category) || undefined,
          seasonalMoment: asString(idea.seasonalMoment) || undefined,
          localEvent: asString(idea.localEvent) || undefined,
          eventDate: asString(idea.eventDate) || undefined,
          sourceUrl: asString(idea.sourceUrl) || undefined,
          visualDirection: asString(idea.visualDirection) || undefined,
          assetUrl: asString(idea.assetUrl) || undefined,
          assetAltText: asString(idea.assetAltText) || undefined
        };
      }).slice(0, 10)
    : [];
  const socialPostIdeas = rawSocialPostIdeas.length > 0
    ? rawSocialPostIdeas
    : buildSocialPostIdeasFromInsights({ painPoints, strengths });
  const rawReviewSnapshot = source.reviewSnapshot && typeof source.reviewSnapshot === "object"
    ? source.reviewSnapshot as Record<string, unknown>
    : null;
  const reviewSnapshot = rawReviewSnapshot
    ? {
        reviewsCount: asNonNegativeInteger(rawReviewSnapshot.reviewsCount),
        positiveCount: asNonNegativeInteger(rawReviewSnapshot.positiveCount),
        neutralCount: asNonNegativeInteger(rawReviewSnapshot.neutralCount),
        negativeCount: asNonNegativeInteger(rawReviewSnapshot.negativeCount)
      }
    : undefined;

  return {
    painPoints,
    strengths,
    priorityActions,
    socialPostIdeas,
    reviewSnapshot
  };
}

export function getReviewSnapshotSummary(reviews: Review[]): NonNullable<ReviewInsightsAnalysis["reviewSnapshot"]> {
  return {
    reviewsCount: reviews.length,
    positiveCount: reviews.filter((review) => review.sentiment === "positif").length,
    neutralCount: reviews.filter((review) => review.sentiment === "neutre").length,
    negativeCount: reviews.filter((review) => review.sentiment === "negatif").length
  };
}

export function alignInsightsWithReviews(analysis: ReviewInsightsAnalysis, reviews: Review[]): ReviewInsightsAnalysis {
  const painPoints = analysis.painPoints
    .map((point) => {
      const evidenceExamples = getEvidenceExamples(point.examples, reviews);
      const titleSupported = reviews.some((review) => (review.rating <= 3 || review.sentiment === "negatif") && reviewMatchesTitleTokens(review, point.title));

      return {
        ...point,
        examples: evidenceExamples.length > 0 ? evidenceExamples : point.examples
      };
    })
    .filter((point) => point.examples.length > 0 || reviews.some((review) => (review.rating <= 3 || review.sentiment === "negatif") && reviewMatchesTitleTokens(review, point.title)))
    .slice(0, 4);

  const strengths = analysis.strengths
    .map((strength) => {
      const evidenceExamples = getEvidenceExamples(strength.examples, reviews);
      const titleSupported = reviews.some((review) => review.rating >= 4 && reviewMatchesTitleTokens(review, strength.title));

      return {
        ...strength,
        examples: evidenceExamples.length > 0 ? evidenceExamples : strength.examples
      };
    })
    .filter((strength) => strength.examples.length > 0 || reviews.some((review) => review.rating >= 4 && reviewMatchesTitleTokens(review, strength.title)))
    .slice(0, 4);

  const allowedPainTitles = new Set(painPoints.map((item) => item.title));
  const allowedStrengthTitles = new Set(strengths.map((item) => item.title));
  const socialPostIdeas = analysis.socialPostIdeas.filter((idea) => {
    if (idea.sourcePainPoint) {
      return allowedPainTitles.has(idea.sourcePainPoint);
    }

    if (idea.sourceStrength) {
      return allowedStrengthTitles.has(idea.sourceStrength);
    }

    return false;
  });

  return {
    ...analysis,
    painPoints,
    strengths,
    socialPostIdeas
  };
}

export function buildSocialPostIdeasFromInsights({
  painPoints,
  strengths
}: {
  painPoints: ReviewPainPoint[];
  strengths: ReviewStrength[];
}): ReviewSocialPostIdea[] {
  const painIdeas = painPoints.slice(0, 3).map((painPoint) => ({
    platform: "instagram" as const,
    title: `Répondre à : ${painPoint.title}`,
    angle: painPoint.recommendation || "Transformer une difficulté client en conseil utile et rassurant.",
    sourcePainPoint: painPoint.title
  }));
  const strengthIdeas = strengths.slice(0, 3).map((strength) => ({
    platform: "facebook" as const,
    title: `Mettre en avant : ${strength.title}`,
    angle: strength.communicationAngle || "Valoriser ce que les clients apprécient déjà.",
    sourceStrength: strength.title
  }));

  return [...painIdeas, ...strengthIdeas].slice(0, 6);
}

function dedupeSocialPostIdeas(ideas: ReviewSocialPostIdea[]) {
  const unique = new Map<string, ReviewSocialPostIdea>();

  ideas.forEach((idea) => {
    const source = idea.sourcePainPoint ?? idea.sourceStrength ?? "avis";
    const key = `${idea.platform}-${idea.title.toLowerCase()}-${source.toLowerCase()}`;

    if (!unique.has(key)) {
      unique.set(key, idea);
    }
  });

  return [...unique.values()];
}

export function enforceSocialPostIdeaRules(analysis: ReviewInsightsAnalysis, reviews: Review[]): ReviewInsightsAnalysis {
  const targetCount = getSocialRecommendationsTargetCount(reviews.length);

  const inferredIdeas = dedupeSocialPostIdeas([
    ...analysis.socialPostIdeas,
    ...buildSocialPostIdeasFromInsights({
      painPoints: analysis.painPoints,
      strengths: analysis.strengths
    })
  ]);

  const socialPostIdeas = dedupeSocialPostIdeas(inferredIdeas).slice(0, targetCount);

  return {
    ...analysis,
    socialPostIdeas
  };
}

export function ensureReviewInsightsPostIdeas(analysis: ReviewInsightsAnalysis | null | undefined): ReviewInsightsAnalysis | null {
  if (!analysis) {
    return null;
  }

  if (analysis.socialPostIdeas.length > 0) {
    return analysis;
  }

  return {
    ...analysis,
    socialPostIdeas: buildSocialPostIdeasFromInsights({
      painPoints: analysis.painPoints,
      strengths: analysis.strengths
    })
  };
}

export function getFallbackReviewInsights(reviews: Review[]): ReviewInsightsAnalysis {
  if (reviews.length === 0) {
    return emptyAnalysis;
  }

  const lowerReviews = reviews.map((review) => ({ ...review, lowerText: review.text.toLowerCase() }));
  const painCandidates = [
    { title: "Attente trop longue", keywords: ["attente", "attendre", "retard", "long"], recommendation: "Communiquer sur les meilleurs horaires pour venir ou proposer une réservation." },
    { title: "Prix jugé élevé", keywords: ["cher", "prix", "tarif"], recommendation: "Expliquer la qualité, le savoir-faire ou les services inclus dans vos contenus." },
    { title: "Difficulté à joindre le commerce", keywords: ["joindre", "téléphone", "répond", "contact"], recommendation: "Mettre en avant les canaux de contact et les horaires de réponse." },
    { title: "Disponibilité variable", keywords: ["disponible", "stock", "rupture", "manque"], recommendation: "Prévenir les clients sur les disponibilités ou proposer une alternative claire." }
  ];
  const strengthCandidates = [
    { title: "Accueil chaleureux", keywords: ["accueil", "gentil", "gentille", "sympa", "sourire"], angle: "Créer un post mettant en avant l’équipe et l’ambiance humaine du commerce." },
    { title: "Qualité appréciée", keywords: ["qualité", "excellent", "parfait", "super", "beau"], angle: "Valoriser le savoir-faire et les produits les plus appréciés." },
    { title: "Conseils utiles", keywords: ["conseil", "conseillé", "écoute", "aide"], angle: "Montrer comment l’équipe accompagne les clients dans leur choix." }
  ];

  const painPoints = painCandidates
    .map((candidate) => {
      const matches = lowerReviews.filter((review) => candidate.keywords.some((keyword) => review.lowerText.includes(keyword)));
      return {
        title: candidate.title,
        frequency: matches.length >= 3 ? "élevée" : matches.length >= 1 ? "moyenne" : "faible",
        summary: matches.length > 0 ? `${matches.length} avis font ressortir ce point de friction.` : "Ce point mérite d’être surveillé.",
        examples: matches.slice(0, 2).map((review) => review.text),
        recommendation: candidate.recommendation
      } satisfies ReviewPainPoint;
    })
    .filter((candidate) => candidate.examples.length > 0)
    .slice(0, 3);

  const strengths = strengthCandidates
    .map((candidate) => {
      const matches = lowerReviews.filter((review) => candidate.keywords.some((keyword) => review.lowerText.includes(keyword)));
      return {
        title: candidate.title,
        summary: matches.length > 0 ? `${matches.length} avis valorisent ce point fort.` : "Un point fort à confirmer avec davantage d'avis.",
        examples: matches.slice(0, 2).map((review) => review.text),
        communicationAngle: limitText(candidate.angle, "Valoriser ce point fort dans un contenu simple.")
      } satisfies ReviewStrength;
    })
    .filter((candidate) => candidate.examples.length > 0)
    .slice(0, 3);

  const firstPain = painPoints[0];
  const firstStrength = strengths[0];

  return enforceSocialPostIdeaRules({
    painPoints,
    strengths,
    priorityActions: [
      firstPain
        ? {
            title: `Transformer les retours sur ${firstPain.title.toLowerCase()} en réassurance`,
            impact: "élevé",
            difficulty: "facile",
            description: firstPain.recommendation,
            channel: "reviews",
            strategyPoints: [
              "Préparer une réponse cohérente qui reconnaît clairement le problème remonté.",
              firstPain.recommendation,
              "Automatiser le premier brouillon tout en gardant une validation humaine."
            ]
          }
        : {
            title: "Demander de nouveaux avis récents",
            impact: "moyen",
            difficulty: "facile",
            description: "Relancer les clients satisfaits permet d’obtenir une lecture plus fraîche de l’expérience.",
            channel: "reviews",
            strategyPoints: [
              "Cibler les clients satisfaits après leur passage.",
              "Envoyer une demande courte au moment où l’expérience est encore récente."
            ]
          },
      {
        title: firstStrength ? `Faire connaître votre point fort : ${firstStrength.title.toLowerCase()}` : "Valoriser les retours positifs",
        impact: "élevé",
        difficulty: "facile",
        description: firstStrength?.communicationAngle ?? "Transformer les avis positifs en contenu de réassurance.",
        channel: "social",
        strategyPoints: [
          firstStrength?.communicationAngle ?? "Créer un contenu centré sur ce que les clients apprécient déjà.",
          "Reprendre les mots des clients pour rendre le message plus crédible.",
          "Terminer par une invitation simple à découvrir le commerce."
        ]
      },
      {
        title: "Construire une audience client mieux qualifiée",
        impact: "moyen",
        difficulty: "moyenne",
        description: "Collecter les préférences clients pour envoyer des communications plus pertinentes.",
        channel: "rcu",
        strategyPoints: [
          "Créer un formulaire court avec uniquement les informations utiles.",
          "Segmenter les contacts selon leurs attentes et leur fréquence de visite.",
          "Utiliser ces segments pour personnaliser les prochaines campagnes."
        ]
      }
    ],
    socialPostIdeas: [
      firstPain
        ? {
            platform: "instagram",
            title: `Comment éviter : ${firstPain.title.toLowerCase()}`,
            angle: "Transformer une douleur client en conseil pratique.",
            sourcePainPoint: firstPain.title
          }
        : {
            platform: "instagram",
            title: firstStrength ? `Pourquoi nos clients aiment : ${firstStrength.title.toLowerCase()}` : "Ce que nos clients aiment chez nous",
            angle: firstStrength?.communicationAngle ?? "Valoriser les avis positifs pour rassurer les nouveaux clients.",
            sourceStrength: firstStrength?.title
          }
    ],
    reviewSnapshot: getReviewSnapshotSummary(reviews)
  }, reviews);
}

export function mapInsightRow(row: ReviewInsightRow | null | undefined) {
  if (!row) {
    return null;
  }

  return validateReviewInsights(row.analysis_json);
}

export function getLatestReviewDate(reviews: Review[]) {
  const timestamps = reviews
    .map((review) => review.updatedAt ?? review.createdAt)
    .filter((date): date is string => Boolean(date))
    .map((date) => new Date(date).getTime())
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

export function getReviewInsightsVersion(reviews: Review[]) {
  return {
    reviewsCount: reviews.length,
    latestReviewUpdatedAt: getLatestReviewDate(reviews)
  };
}

export function hasReviewInsightsSourceChanged(
  stored: { reviews_count?: number | null; latest_review_updated_at?: string | null } | null | undefined,
  reviews: Review[]
) {
  if (!stored || stored.reviews_count === null || stored.reviews_count === undefined) {
    return true;
  }

  const current = getReviewInsightsVersion(reviews);
  if (stored.reviews_count !== current.reviewsCount) {
    return true;
  }

  const storedTimestamp = stored.latest_review_updated_at
    ? new Date(stored.latest_review_updated_at).getTime()
    : null;
  const currentTimestamp = current.latestReviewUpdatedAt
    ? new Date(current.latestReviewUpdatedAt).getTime()
    : null;

  return storedTimestamp !== currentTimestamp;
}

const REVIEW_INSIGHTS_TIME_ZONE = "Europe/Paris";
const REVIEW_INSIGHTS_REFRESH_HOUR = 8;

function getReviewInsightsLocalParts(date: Date) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: REVIEW_INSIGHTS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour)
  };
}

export function isReviewInsightsRefreshWindow(date = new Date()) {
  return getReviewInsightsLocalParts(date).hour === REVIEW_INSIGHTS_REFRESH_HOUR;
}

export function isDailyReviewInsightsRefreshDue(updatedAt: string | null | undefined, date = new Date()) {
  if (!updatedAt) {
    return true;
  }

  const now = getReviewInsightsLocalParts(date);
  const lastUpdate = getReviewInsightsLocalParts(new Date(updatedAt));

  return now.hour >= REVIEW_INSIGHTS_REFRESH_HOUR && now.dateKey !== lastUpdate.dateKey;
}
