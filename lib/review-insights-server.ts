import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMerchant } from "@/lib/merchants";
import type { Review } from "@/lib/mock-data";
import {
  alignInsightsWithReviews,
  emptyAnalysis,
  enforceSocialPostIdeaRules,
  ensureReviewInsightsPostIdeas,
  getFallbackReviewInsights,
  getReviewSnapshotSummary,
  getReviewInsightsVersion,
  hasReviewInsightsSourceChanged,
  REVIEW_INSIGHTS_STORAGE_TITLE,
  type ReviewInsightsAnalysis,
  validateReviewInsights
} from "@/lib/review-insights";
import { getTopSocialRecommendations } from "@/lib/social-recommendations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json, MerchantRow, ReviewInsightRow, SocialPostIdeaRow } from "@/lib/supabase/types";

type OpenAIResponseContent = {
  type?: string;
  text?: string;
};

type OpenAIResponseOutput = {
  type?: string;
  content?: OpenAIResponseContent[];
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
  error?: {
    message?: string;
  };
};

function extractText(body: OpenAIResponseBody) {
  if (body.output_text) {
    return body.output_text.trim();
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function isMissingInsightsTableError(message: string) {
  return message.includes("Could not find the table 'public.review_insights'");
}

async function getLegacyStoredReviewInsights(
  merchant: MerchantRow,
  supabase: SupabaseClient<Database>
): Promise<ReviewInsightRow | null> {
  const { data, error } = await supabase
    .from("hans_recommendations")
    .select("id, description, created_at")
    .eq("merchant_id", merchant.id)
    .eq("title", REVIEW_INSIGHTS_STORAGE_TITLE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  try {
    const payload = JSON.parse(data.description) as {
      analysis: unknown;
      reviewsCount: number;
      latestReviewUpdatedAt: string | null;
      updatedAt: string;
    };

    return {
      id: data.id,
      merchant_id: merchant.id,
      analysis_json: validateReviewInsights(payload.analysis) as unknown as Json,
      reviews_count: payload.reviewsCount,
      latest_review_updated_at: payload.latestReviewUpdatedAt,
      created_at: data.created_at,
      updated_at: payload.updatedAt
    };
  } catch {
    return null;
  }
}

export async function getStoredReviewInsights(
  merchant?: MerchantRow | null,
  client?: SupabaseClient<Database>
) {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return null;
  }

  const supabase = client ?? await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("review_insights")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    if (isMissingInsightsTableError(error.message)) {
      return getLegacyStoredReviewInsights(currentMerchant, supabase);
    }

    throw new Error(error.message);
  }

  return data;
}

export async function getOrRefreshReviewInsights(
  merchant: MerchantRow,
  reviews: Review[],
  client?: SupabaseClient<Database>
) {
  const supabase = client ?? await createServerSupabaseClient();
  const stored = await getStoredReviewInsights(merchant, supabase);

  if (!hasReviewInsightsSourceChanged(stored, reviews)) {
    return stored;
  }

  const { data: postRows, error: postsError } = await supabase
    .from("social_posts")
    .select("*")
    .eq("merchant_id", merchant.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);

  if (postsError) {
    throw new Error(postsError.message);
  }

  const analysis = reviews.length > 0
    ? await analyzeReviewsWithOpenAI(reviews, merchant)
    : emptyAnalysis;
  const socialPostIdeas = await getTopSocialRecommendations({
    analysis,
    reviews,
    merchant,
    posts: postRows ?? []
  });

  return saveReviewInsights(merchant, {
    ...analysis,
    socialPostIdeas,
    reviewSnapshot: getReviewSnapshotSummary(reviews)
  }, reviews, supabase);
}

export async function getSocialPostIdeas(merchant?: MerchantRow | null): Promise<SocialPostIdeaRow[]> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("social_post_ideas")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table")) {
      return [];
    }

    throw new Error(error.message);
  }

  return data;
}

export async function analyzeReviewsWithOpenAI(reviews: Review[], merchant: MerchantRow): Promise<ReviewInsightsAnalysis> {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

  if (!openAiApiKey) {
    return getFallbackReviewInsights(reviews);
  }

  const completeReviewSet = reviews.map((review) => ({
    author: review.author,
    rating: review.rating,
    sentiment: review.sentiment,
    status: review.status,
    text: review.text.slice(0, 1200),
    createdAt: review.createdAt
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions:
        "Tu es Hans, l'agent IA d'AtriumOne. Tu analyses des avis clients Google pour un commerce de proximité. Retourne uniquement un JSON valide, sans Markdown, sans commentaire. Le JSON doit contenir painPoints, strengths, priorityActions et socialPostIdeas. Utilise un vocabulaire simple pour commerçant non-technique. Ne crée pas de faits non présents dans les avis. IMPORTANT UX: AtriumOne affiche des conclusions, pas un rapport. Retourne maximum 4 douleurs, maximum 4 points forts et entre 2 et 4 actions recommandées. Chaque summary, recommendation et communicationAngle doit faire 120 caractères maximum, en une seule phrase claire. Pour chaque action recommandée, choisis un seul channel parmi sms, social, rcu ou reviews selon ce qui répond le mieux à l'analyse. Ne sélectionne pas un canal sans justification dans les avis. Donne un title spécifique, impact, difficulty, une description courte et 2 à 3 strategyPoints concrets expliquant la stratégie. Les strategyPoints doivent citer le signal client exploité, l'approche proposée et le résultat recherché. Pour socialPostIdeas, interdiction de proposer un sujet générique ou non présent dans les avis. Chaque idée doit venir d’un thème vraiment cité dans plusieurs avis ou d’un avis très marquant. Les titres doivent être spécifiques au commerce et aux retours clients, jamais des placeholders.",
      input: JSON.stringify({
        merchant: {
          businessName: merchant.business_name,
          businessType: merchant.business_type,
          city: merchant.city,
          description: merchant.description
        },
        expectedShape: {
          painPoints: [{ title: "Attente trop longue", frequency: "élevée", summary: "Les clients mentionnent régulièrement des délais d’attente trop importants.", examples: ["Avis"], recommendation: "Réduire l’attente ou mieux communiquer sur les heures d’affluence." }],
          strengths: [{ title: "Accueil chaleureux", summary: "Les clients apprécient régulièrement la qualité de l’accueil.", examples: ["Avis"], communicationAngle: "Communiquer davantage sur l’équipe." }],
          priorityActions: [{ title: "Rassurer sur les temps d’attente", channel: "sms", impact: "élevé", difficulty: "facile", description: "Prévenir les clients avant les périodes chargées.", strategyPoints: ["Cibler les clients concernés par les créneaux les plus chargés.", "Envoyer un message court avant le pic d’affluence.", "Mesurer si les nouveaux avis mentionnent moins l’attente."] }],
          socialPostIdeas: [{ platform: "instagram", title: "Titre", angle: "Angle", sourcePainPoint: "Douleur ou point fort source" }]
        },
        reviewCount: reviews.length,
        reviews: completeReviewSet
      }),
      max_output_tokens: 2400
    })
  });

  const body = (await response.json()) as OpenAIResponseBody;

  if (!response.ok) {
    return getFallbackReviewInsights(reviews);
  }

  try {
    return enforceSocialPostIdeaRules(
      alignInsightsWithReviews(validateReviewInsights(JSON.parse(extractText(body))), reviews),
      reviews
    );
  } catch {
    return getFallbackReviewInsights(reviews);
  }
}

export async function saveReviewInsights(
  merchant: MerchantRow,
  analysis: ReviewInsightsAnalysis,
  reviews?: Review[],
  client?: SupabaseClient<Database>
) {
  const supabase = client ?? await createServerSupabaseClient();
  const now = new Date().toISOString();
  const safeReviews = reviews ?? [];
  const normalizedAnalysis = validateReviewInsights(analysis);
  const analysisWithIdeas = enforceSocialPostIdeaRules(ensureReviewInsightsPostIdeas(normalizedAnalysis) ?? normalizedAnalysis, safeReviews);
  const { reviewsCount, latestReviewUpdatedAt } = getReviewInsightsVersion(safeReviews);

  const { data, error } = await supabase
    .from("review_insights")
    .upsert({
      merchant_id: merchant.id,
      analysis_json: analysisWithIdeas as unknown as Json,
      reviews_count: reviewsCount,
      latest_review_updated_at: latestReviewUpdatedAt,
      updated_at: now
    }, { onConflict: "merchant_id" })
    .select("*")
    .single();

  if (error) {
    if (isMissingInsightsTableError(error.message)) {
      const payload = JSON.stringify({
        analysis: analysisWithIdeas,
        reviewsCount,
        latestReviewUpdatedAt,
        updatedAt: now
      });
      const { data: existing, error: existingError } = await supabase
        .from("hans_recommendations")
        .select("id, created_at")
        .eq("merchant_id", merchant.id)
        .eq("title", REVIEW_INSIGHTS_STORAGE_TITLE)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      const fallbackResult = existing
        ? await supabase
            .from("hans_recommendations")
            .update({ description: payload, status: "done", completed_at: now })
            .eq("id", existing.id)
            .select("id, created_at")
            .single()
        : await supabase
            .from("hans_recommendations")
            .insert({
              merchant_id: merchant.id,
              title: REVIEW_INSIGHTS_STORAGE_TITLE,
              description: payload,
              status: "done",
              completed_at: now
            })
            .select("id, created_at")
            .single();

      if (fallbackResult.error || !fallbackResult.data) {
        throw new Error(fallbackResult.error?.message ?? "Stockage de l’analyse impossible.");
      }

      return {
        id: fallbackResult.data.id,
        merchant_id: merchant.id,
        analysis_json: analysisWithIdeas as unknown as Json,
        reviews_count: reviewsCount,
        latest_review_updated_at: latestReviewUpdatedAt,
        created_at: fallbackResult.data.created_at,
        updated_at: now
      } satisfies ReviewInsightRow;
    }

    throw new Error(error.message);
  }

  await supabase.from("social_post_ideas").delete().eq("merchant_id", merchant.id);

  if (analysisWithIdeas.socialPostIdeas.length > 0) {
    const { error: ideasError } = await supabase
      .from("social_post_ideas")
      .insert(
        analysisWithIdeas.socialPostIdeas.map((idea) => ({
          merchant_id: merchant.id,
          platform: idea.platform,
          title: idea.title,
          angle: idea.angle,
          source_type: idea.sourcePainPoint
            ? "pain_point"
            : idea.sourceStrength
              ? "strength"
              : idea.localEvent
                ? "local_event"
                : idea.seasonalMoment
                  ? "seasonal"
                  : "editorial",
          source_reference: idea.sourcePainPoint ?? idea.sourceStrength ?? idea.localEvent ?? idea.seasonalMoment ?? null
        }))
      );

    if (ideasError) {
      throw new Error(ideasError.message);
    }
  }

  return data;
}
