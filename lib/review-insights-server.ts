import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMerchant } from "@/lib/merchants";
import type { Review } from "@/lib/mock-data";
import {
  alignInsightsWithReviews,
  enforceSocialPostIdeaRules,
  ensureReviewInsightsPostIdeas,
  getFallbackReviewInsights,
  getReviewInsightsVersion,
  mapInsightRow,
  prepareReviewInsightsForDisplay,
  shouldRefreshReviewInsights,
  type ReviewInsightsAnalysis,
  validateReviewInsights
} from "@/lib/review-insights";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json, MerchantRow, SocialPostIdeaRow } from "@/lib/supabase/types";

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

export async function getStoredReviewInsights(merchant?: MerchantRow | null) {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("review_insights")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    if (error.message.includes("Could not find the table")) {
      return null;
    }

    throw new Error(error.message);
  }

  return data;
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

  const sample = reviews.slice(0, 80).map((review) => ({
    author: review.author,
    rating: review.rating,
    sentiment: review.sentiment,
    status: review.status,
    text: review.text,
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
        reviews: sample
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
  const analysisWithIdeas = enforceSocialPostIdeaRules(ensureReviewInsightsPostIdeas(analysis) ?? analysis, safeReviews);
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
          source_type: idea.sourcePainPoint ? "pain_point" : "strength",
          source_reference: idea.sourcePainPoint ?? idea.sourceStrength ?? null
        }))
      );

    if (ideasError) {
      throw new Error(ideasError.message);
    }
  }

  return data;
}

export async function getFreshReviewInsights(
  reviews: Review[],
  merchant: MerchantRow
): Promise<ReviewInsightsAnalysis> {
  const storedInsights = await getStoredReviewInsights(merchant);

  if (storedInsights && !shouldRefreshReviewInsights({ reviews, storedInsights })) {
    return prepareReviewInsightsForDisplay(mapInsightRow(storedInsights), reviews) ?? getFallbackReviewInsights(reviews);
  }

  const analysis = await analyzeReviewsWithOpenAI(reviews, merchant);

  try {
    const saved = await saveReviewInsights(merchant, analysis, reviews);
    return prepareReviewInsightsForDisplay(mapInsightRow(saved), reviews) ?? analysis;
  } catch {
    return prepareReviewInsightsForDisplay(analysis, reviews) ?? analysis;
  }
}
