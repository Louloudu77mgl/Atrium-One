import { getGoogleOAuthConfig } from "@/lib/google-oauth";
import { getReviewAutomationDecision } from "@/lib/review-automation";
import { hansHtmlToPlainText, sanitizeHansHtml } from "@/lib/sanitize-hans-html";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GoogleConnectionRow, MerchantAutomationSettingsRow, MerchantRow } from "@/lib/supabase/types";

type GoogleReview = {
  name?: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string };
};

type GoogleReviewsResponse = {
  reviews?: GoogleReview[];
  nextPageToken?: string;
  error?: { message?: string };
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
};

type AutomationResult = {
  merchant_id: string;
  review_name?: string;
  status: "published" | "drafted" | "skipped" | "error";
  message?: string;
};

const ratings: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export async function runReviewAutomations(limit = 5) {
  const supabase = createSupabaseAdminClient();
  const { data: settingsRows, error: settingsError } = await supabase
    .from("merchant_automation_settings")
    .select("*")
    .eq("reviews_auto_reply_enabled", true)
    .order("updated_at", { ascending: true });

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const results: AutomationResult[] = [];

  for (const settings of settingsRows ?? []) {
    if (results.filter((result) => result.status !== "skipped").length >= limit) {
      break;
    }

    try {
      const [{ data: merchant, error: merchantError }, { data: connection, error: connectionError }] = await Promise.all([
        supabase.from("merchants").select("*").eq("id", settings.merchant_id).maybeSingle(),
        supabase.from("google_connections").select("*").eq("merchant_id", settings.merchant_id).eq("status", "connected").maybeSingle()
      ]);

      if (merchantError) throw new Error(merchantError.message);
      if (connectionError) throw new Error(connectionError.message);
      if (!merchant || !connection?.google_location_id) {
        results.push({ merchant_id: settings.merchant_id, status: "skipped", message: "Google Business non connecté." });
        continue;
      }

      const available = Math.max(0, limit - results.filter((result) => result.status !== "skipped").length);
      const merchantResults = await processMerchantReviews({
        merchant,
        connection,
        settings,
        limit: available
      });
      results.push(...merchantResults);
    } catch (error) {
      results.push({
        merchant_id: settings.merchant_id,
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  return results;
}

async function processMerchantReviews({
  merchant,
  connection,
  settings,
  limit
}: {
  merchant: MerchantRow;
  connection: GoogleConnectionRow;
  settings: MerchantAutomationSettingsRow;
  limit: number;
}) {
  const supabase = createSupabaseAdminClient();
  const accessToken = await refreshGoogleAccessToken(connection);
  await supabase
    .from("google_connections")
    .update({ access_token_encrypted: accessToken, status: "connected" })
    .eq("merchant_id", merchant.id);

  const reviews = await listGoogleReviews(accessToken, connection.google_location_id as string);
  const activationTime = new Date(settings.updated_at ?? settings.created_at).getTime();
  const candidates = reviews
    .filter((review) => !review.reviewReply?.comment && review.name && review.createTime)
    .filter((review) => new Date(review.createTime as string).getTime() >= activationTime)
    .sort((left, right) => new Date(left.createTime as string).getTime() - new Date(right.createTime as string).getTime())
    .slice(0, limit);
  const results: AutomationResult[] = [];

  for (const review of candidates) {
    try {
      results.push(await processGoogleReview({ merchant, settings, review, accessToken }));
    } catch (error) {
      results.push({
        merchant_id: merchant.id,
        review_name: review.name,
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  if (candidates.length === 0) {
    results.push({ merchant_id: merchant.id, status: "skipped", message: "Aucun nouvel avis éligible." });
  }

  return results;
}

async function processGoogleReview({
  merchant,
  settings,
  review,
  accessToken
}: {
  merchant: MerchantRow;
  settings: MerchantAutomationSettingsRow;
  review: GoogleReview;
  accessToken: string;
}): Promise<AutomationResult> {
  const supabase = createSupabaseAdminClient();
  const rating = ratings[review.starRating ?? ""] ?? 3;
  const reviewText = review.comment?.trim() || "Avis sans commentaire";
  const effectiveSettings = {
    ...settings,
    review_automation_mode: settings.review_automation_mode ?? "automatic_guarded",
    reviews_five_star_action: settings.reviews_five_star_action ?? "automatic",
    reviews_four_star_action: settings.reviews_four_star_action ?? "automatic",
    reviews_three_star_action: settings.reviews_three_star_action ?? "validation",
    reviews_one_two_star_action: settings.reviews_one_two_star_action ?? "disabled",
    always_validate_negative_reviews: settings.always_validate_negative_reviews ?? true,
    block_sensitive_reviews: settings.block_sensitive_reviews ?? true
  };
  const decision = getReviewAutomationDecision({ rating, reviewText, settings: effectiveSettings });

  if (decision.action === "disabled") {
    return { merchant_id: merchant.id, review_name: review.name, status: "skipped", message: "Automatisation désactivée pour cette note." };
  }

  const localReview = await findOrCreateReview({ merchant, review, rating, reviewText });
  const { data: existingReply, error: existingReplyError } = await supabase
    .from("generated_replies")
    .select("*")
    .eq("review_id", localReview.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingReplyError) throw new Error(existingReplyError.message);
  if (existingReply?.is_edited) {
    return { merchant_id: merchant.id, review_name: review.name, status: "skipped", message: "Réponse modifiée manuellement : publication automatique ignorée." };
  }

  const replyHtml = existingReply?.reply_text || await generateHansReply({ merchant, review, rating, reviewText });
  let replyId = existingReply?.id;

  if (!replyId) {
    const { data: insertedReply, error: insertError } = await supabase
      .from("generated_replies")
      .insert({
        review_id: localReview.id,
        generated_text: replyHtml,
        reply_text: replyHtml,
        status: "generated",
        is_edited: false,
        edited_at: null
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    replyId = insertedReply.id;
  }

  if (decision.requiresValidation || decision.blockedBySafety) {
    await updateReviewStatus(localReview.id, "generated");
    return {
      merchant_id: merchant.id,
      review_name: review.name,
      status: "drafted",
      message: decision.blockedBySafety ? `Mot sensible détecté : ${decision.sensitiveKeyword}` : "Validation humaine requise par le workflow."
    };
  }

  const plainReply = hansHtmlToPlainText(replyHtml);
  const publishResponse = await fetch(`https://mybusiness.googleapis.com/v4/${review.name}/reply`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ comment: plainReply }),
    cache: "no-store"
  });

  if (!publishResponse.ok) {
    const body = await publishResponse.text();
    throw new Error(body || "Google a refusé la publication automatique.");
  }

  const replyUpdate = await supabase.from("generated_replies").update({ status: "published_auto" }).eq("id", replyId);
  if (replyUpdate.error) {
    const fallback = await supabase.from("generated_replies").update({ status: "published" }).eq("id", replyId);
    if (fallback.error) throw new Error(fallback.error.message);
  }
  await updateReviewStatus(localReview.id, "published_auto");

  return { merchant_id: merchant.id, review_name: review.name, status: "published" };
}

async function findOrCreateReview({
  merchant,
  review,
  rating,
  reviewText
}: {
  merchant: MerchantRow;
  review: GoogleReview;
  rating: number;
  reviewText: string;
}) {
  const supabase = createSupabaseAdminClient();
  const createdAt = review.createTime as string;
  const { data: existing, error: existingError } = await supabase
    .from("reviews")
    .select("id, status, created_at")
    .eq("merchant_id", merchant.id)
    .eq("created_at", createdAt)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const payload = {
    merchant_id: merchant.id,
    author_name: review.reviewer?.isAnonymous ? "Client Google" : review.reviewer?.displayName ?? "Client Google",
    rating,
    review_text: reviewText,
    status: rating <= 2 ? "urgent" as const : "a_traiter" as const,
    sentiment: rating >= 4 ? "positif" as const : rating <= 2 ? "negatif" as const : "neutre" as const,
    created_at: createdAt
  };
  const { data: inserted, error: insertError } = await supabase.from("reviews").insert(payload).select("id, status, created_at").single();
  if (insertError) throw new Error(insertError.message);
  return inserted;
}

async function updateReviewStatus(reviewId: string, status: "generated" | "published_auto") {
  const supabase = createSupabaseAdminClient();
  const update = await supabase.from("reviews").update({ status }).eq("id", reviewId);
  if (!update.error) return;
  const fallbackStatus = status === "published_auto" ? "repondu" : "generated";
  const fallback = await supabase.from("reviews").update({ status: fallbackStatus }).eq("id", reviewId);
  if (fallback.error) throw new Error(fallback.error.message);
}

async function refreshGoogleAccessToken(connection: GoogleConnectionRow) {
  if (!connection.refresh_token_encrypted) {
    if (connection.access_token_encrypted) return connection.access_token_encrypted;
    throw new Error("Token Google absent.");
  }
  const config = getGoogleOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: connection.refresh_token_encrypted,
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });
  const data = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? "Renouvellement Google impossible.");
  return data.access_token;
}

async function listGoogleReviews(accessToken: string, locationId: string) {
  let pageToken: string | undefined;
  const reviews: GoogleReview[] = [];
  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${locationId}/reviews`);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const data = await response.json() as GoogleReviewsResponse;
    if (!response.ok) throw new Error(data.error?.message ?? "Lecture des avis Google impossible.");
    reviews.push(...(data.reviews ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return reviews;
}

async function generateHansReply({
  merchant,
  review,
  rating,
  reviewText
}: {
  merchant: MerchantRow;
  review: GoogleReview;
  rating: number;
  reviewText: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquante.");
  const author = review.reviewer?.isAnonymous ? "Client Google" : review.reviewer?.displayName ?? "Client Google";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      instructions: "Tu rédiges une réponse Google Business humaine, précise et professionnelle en français. Reprends uniquement les détails réellement présents dans l’avis. Ne mentionne jamais l’IA. Retourne uniquement du HTML simple avec les balises p, br, strong ou em.",
      input: [
        `Commerce : ${merchant.business_name}`,
        `Activité : ${merchant.business_type}`,
        `Client : ${author}`,
        `Note : ${rating}/5`,
        `Avis : ${reviewText}`,
        `Ton : ${merchant.response_tone ?? "chaleureux"}`,
        `Termine exactement par : <p>L’équipe ${merchant.business_name}</p>`
      ].join("\n"),
      max_output_tokens: 700
    }),
    cache: "no-store"
  });
  const data = await response.json() as OpenAIResponseBody;
  if (!response.ok) throw new Error(data.error?.message ?? "Hans n’a pas pu générer la réponse.");
  const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
  const sanitized = sanitizeHansHtml(text);
  if (!sanitized) throw new Error("Hans a généré une réponse vide.");
  return sanitized;
}
