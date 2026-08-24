import { getGoogleOAuthConfig } from "@/lib/google-oauth";
import {
  getStoredAutomationSettings,
  listStoredAutomationFlows,
  saveAutomationExecutionLog,
  type StoredAutomationFlow
} from "@/lib/automation-execution-store";
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

export type AutomationResult = {
  merchant_id: string;
  local_review_id?: string;
  review_name?: string;
  customer_name?: string;
  rating?: number;
  status: "published" | "drafted" | "skipped" | "error";
  message?: string;
  flow_id?: string;
  flow_title?: string;
  steps?: AutomationResultStep[];
};

type AutomationResultStep = {
  node_id: string;
  node_type: string;
  title: string;
  status: "success" | "waiting" | "skipped" | "error";
  result: string;
};

type ReviewFlowPlan = {
  flow: StoredAutomationFlow;
  nodes: StoredAutomationFlow["nodes"];
  action: "automatic" | "validation" | "disabled";
  tone: string | null;
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

    const available = Math.max(0, limit - results.filter((result) => result.status !== "skipped").length);
    results.push(...await runReviewAutomationsForMerchant(settings.merchant_id, available));
  }

  return results;
}

export async function runReviewAutomationsForMerchant(merchantId: string, limit = 5) {
  const supabase = createSupabaseAdminClient();
  let results: AutomationResult[];

  try {
    const [{ data: databaseSettings, error: settingsError }, { data: merchant, error: merchantError }, { data: connection, error: connectionError }, storedSettings, storedFlows] = await Promise.all([
      supabase.from("merchant_automation_settings").select("*").eq("merchant_id", merchantId).maybeSingle(),
      supabase.from("merchants").select("*").eq("id", merchantId).maybeSingle(),
      supabase.from("google_connections").select("*").eq("merchant_id", merchantId).eq("status", "connected").maybeSingle(),
      getStoredAutomationSettings(merchantId).catch(() => null),
      listStoredAutomationFlows(merchantId).catch(() => [])
    ]);

    if (settingsError) throw new Error(settingsError.message);
    if (merchantError) throw new Error(merchantError.message);
    if (connectionError) throw new Error(connectionError.message);

    const settings = databaseSettings
      ? { ...databaseSettings, ...storedSettings, id: databaseSettings.id, merchant_id: databaseSettings.merchant_id, created_at: databaseSettings.created_at }
      : null;

    const activeReviewFlows = storedFlows
      .filter((flow) => flow.status === "active" && flow.nodes.some((node) => node.type === "google_review"))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    if (!settings?.reviews_auto_reply_enabled) {
      results = [{ merchant_id: merchantId, status: "skipped", message: "Automatisation des avis désactivée." }];
    } else if (!activeReviewFlows.length) {
      results = [{ merchant_id: merchantId, status: "skipped", message: "Aucun scénario Avis actif n’est enregistré pour ce compte." }];
    } else if (!merchant || !connection?.google_location_id) {
      results = [{ merchant_id: merchantId, status: "skipped", message: "Google Business non connecté." }];
    } else {
      results = await processMerchantReviews({ merchant, connection, settings, flows: activeReviewFlows, limit });
    }
  } catch (error) {
    results = [{
      merchant_id: merchantId,
      status: "error",
      message: error instanceof Error ? error.message : "Erreur inconnue"
    }];
  }

  await Promise.all(results.map((result) => saveAutomationExecutionLog({
    merchant_id: result.merchant_id,
    automation_key: "google_reviews",
    local_review_id: result.local_review_id ?? null,
    review_name: result.review_name ?? null,
    customer_name: result.customer_name ?? null,
    rating: result.rating ?? null,
    status: result.status,
    message: result.message ?? defaultResultMessage(result.status),
    flow_id: result.flow_id ?? null,
    flow_title: result.flow_title ?? null,
    steps: result.steps
  }).catch((error) => {
    console.error("[review-automation] execution_log_failed", {
      merchantId: result.merchant_id,
      message: error instanceof Error ? error.message : "Erreur inconnue"
    });
  })));

  return results;
}

function defaultResultMessage(status: AutomationResult["status"]) {
  if (status === "published") return "Réponse publiée automatiquement sur Google.";
  if (status === "drafted") return "Réponse préparée et mise en attente de validation.";
  if (status === "error") return "L’automatisation a échoué.";
  return "Aucune action nécessaire.";
}

async function processMerchantReviews({
  merchant,
  connection,
  settings,
  flows,
  limit
}: {
  merchant: MerchantRow;
  connection: GoogleConnectionRow;
  settings: MerchantAutomationSettingsRow;
  flows: StoredAutomationFlow[];
  limit: number;
}) {
  const supabase = createSupabaseAdminClient();
  const accessToken = await refreshGoogleAccessToken(connection);
  await supabase
    .from("google_connections")
    .update({ access_token_encrypted: accessToken, status: "connected" })
    .eq("merchant_id", merchant.id);

  const reviews = await listGoogleReviews(accessToken, connection.google_location_id as string);
  const activationTime = Math.min(
    new Date(settings.updated_at ?? settings.created_at).getTime(),
    ...flows.map((flow) => new Date(flow.updatedAt).getTime())
  );
  const candidates = reviews
    .filter((review) => !review.reviewReply?.comment && review.name && review.createTime)
    .filter((review) => new Date(review.createTime as string).getTime() >= activationTime)
    .sort((left, right) => new Date(left.createTime as string).getTime() - new Date(right.createTime as string).getTime())
    .slice(0, limit);
  const results: AutomationResult[] = [];

  for (const review of candidates) {
    try {
      const rating = ratings[review.starRating ?? ""] ?? 3;
      const plans = flows.map((flow) => buildReviewFlowPlan(flow, rating));
      const plan = plans.find((candidate) => candidate.action !== "disabled");
      if (!plan) {
        results.push({
          merchant_id: merchant.id,
          review_name: review.name,
          customer_name: getGoogleReviewerName(review),
          rating,
          status: "skipped",
          message: "Aucun chemin actif du scénario ne correspond à cet avis."
        });
        continue;
      }
      results.push(await processGoogleReview({ merchant, review, accessToken, plan }));
    } catch (error) {
      results.push({
        merchant_id: merchant.id,
        review_name: review.name,
        customer_name: getGoogleReviewerName(review),
        rating: ratings[review.starRating ?? ""] ?? 3,
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
  review,
  accessToken,
  plan
}: {
  merchant: MerchantRow;
  review: GoogleReview;
  accessToken: string;
  plan: ReviewFlowPlan;
}): Promise<AutomationResult> {
  const supabase = createSupabaseAdminClient();
  const rating = ratings[review.starRating ?? ""] ?? 3;
  const reviewText = review.comment?.trim() || "Avis sans commentaire";
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
    return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "skipped", message: "Réponse modifiée manuellement : publication automatique ignorée.", flow_id: plan.flow.id, flow_title: plan.flow.title };
  }
  if (existingReply && ["published", "published_auto", "published_manual"].includes(existingReply.status)) {
    return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "skipped", message: "Réponse déjà publiée : aucune double exécution.", flow_id: plan.flow.id, flow_title: plan.flow.title };
  }
  if (existingReply && plan.action === "validation") {
    return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "skipped", message: "Réponse déjà préparée et en attente de l’action prévue dans le flow.", flow_id: plan.flow.id, flow_title: plan.flow.title };
  }

  let replyHtml = existingReply?.reply_text ?? null;
  let replyId = existingReply?.id;
  const steps: AutomationResultStep[] = [];
  let activeNode: StoredAutomationFlow["nodes"][number] | null = null;

  try {
    for (const node of plan.nodes) {
      activeNode = node;
    if (node.type === "google_review") {
      steps.push(step(node, "success", `Avis ${rating}/5 reçu pour ce compte.`));
      continue;
    }

    if (node.type === "review_rating_gte") {
      const threshold = Number(node.config.rating ?? 4);
      steps.push(step(node, "success", rating >= threshold ? `Condition validée : ${rating} ≥ ${threshold}.` : `Condition non validée : ${rating} < ${threshold}.`));
      continue;
    }

    if (node.type === "generate_review_reply") {
      if (!replyHtml) {
        replyHtml = await generateHansReply({ merchant, review, rating, reviewText, tone: String(node.config.tone ?? plan.tone ?? merchant.response_tone ?? "chaleureux") });
      }
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
      steps.push(step(node, "success", `Réponse générée avec le ton ${String(node.config.tone ?? plan.tone ?? "configuré")}.`));
      continue;
    }

    if (node.type === "notify_merchant") {
      await updateReviewStatus(localReview.id, "generated");
      steps.push(step(node, "success", String(node.config.message ?? "Notification disponible dans AtriumOne.")));
      continue;
    }

    if (node.type === "publish_review_reply") {
      if (!replyHtml || !replyId) throw new Error("Le flow tente de publier avant que Hans ait généré une réponse.");
      if (plan.action !== "automatic" || node.mode !== "automatic") {
        await updateReviewStatus(localReview.id, "generated");
        steps.push(step(node, "waiting", "Publication en attente, conformément au mode de cette card."));
        return {
          merchant_id: merchant.id,
          local_review_id: localReview.id,
          review_name: review.name,
          customer_name: getGoogleReviewerName(review),
          rating,
          status: "drafted",
          message: "Le scénario a préparé la réponse et attend l’action prévue dans le flow.",
          flow_id: plan.flow.id,
          flow_title: plan.flow.title,
          steps
        };
      }

      await publishGoogleReply({ reviewName: review.name as string, replyHtml, replyId, reviewId: localReview.id, accessToken });
      steps.push(step(node, "success", "Réponse publiée sur Google."));
      return {
        merchant_id: merchant.id,
        local_review_id: localReview.id,
        review_name: review.name,
        customer_name: getGoogleReviewerName(review),
        rating,
        status: "published",
        message: `Scénario « ${plan.flow.title} » exécuté : réponse publiée sur Google.`,
        flow_id: plan.flow.id,
        flow_title: plan.flow.title,
        steps
      };
    }

    if (node.type === "stop_flow") {
      steps.push(step(node, "skipped", "Scénario arrêté par cette card."));
      return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "skipped", message: "Scénario arrêté par le flow.", flow_id: plan.flow.id, flow_title: plan.flow.title, steps };
    }

    throw new Error(`La card « ${node.title} » (${node.type}) n’a pas d’exécuteur compatible avec le déclencheur Avis Google.`);
    }

    if (replyHtml) {
      await updateReviewStatus(localReview.id, "generated");
      return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "drafted", message: "Le flow a généré une réponse mais ne contient aucune card de publication.", flow_id: plan.flow.id, flow_title: plan.flow.title, steps };
    }

    return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "skipped", message: "Le chemin exécuté ne contient aucune action de réponse.", flow_id: plan.flow.id, flow_title: plan.flow.title, steps };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    if (activeNode && !steps.some((current) => current.node_id === activeNode?.id && current.status === "error")) {
      steps.push(step(activeNode, "error", message));
    }
    return {
      merchant_id: merchant.id,
      local_review_id: localReview.id,
      review_name: review.name,
      customer_name: getGoogleReviewerName(review),
      rating,
      status: "error",
      message,
      flow_id: plan.flow.id,
      flow_title: plan.flow.title,
      steps
    };
  }
}

function buildReviewFlowPlan(flow: StoredAutomationFlow, rating: number): ReviewFlowPlan {
  const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
  const nodes: StoredAutomationFlow["nodes"] = [];
  const visited = new Set<string>();
  let current = flow.nodes.find((node) => node.type === "google_review");
  let requiresValidation = false;
  let action: ReviewFlowPlan["action"] = "disabled";
  let tone: string | null = null;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    nodes.push(current);

    if (current.type === "stop_flow") break;
    if (current.type === "generate_review_reply") tone = String(current.config.tone ?? "Chaleureux");
    if (current.category === "action" && current.mode !== "automatic") requiresValidation = true;
    if (current.type === "publish_review_reply") {
      action = current.mode === "automatic" && !requiresValidation ? "automatic" : "validation";
      break;
    }

    let branch: "default" | "yes" | "no" = "default";
    if (current.category === "condition") {
      if (current.type !== "review_rating_gte") return { flow, nodes, action: "disabled", tone };
      branch = rating >= Number(current.config.rating ?? 4) ? "yes" : "no";
    }
    const edge = flow.edges.find((candidate) => candidate.source === current?.id && candidate.branch === branch);
    current = edge ? nodesById.get(edge.target) : undefined;
  }

  if (action === "disabled" && nodes.some((node) => node.type === "generate_review_reply")) action = "validation";
  return { flow, nodes, action, tone };
}

function step(node: StoredAutomationFlow["nodes"][number], status: AutomationResultStep["status"], result: string): AutomationResultStep {
  return { node_id: node.id, node_type: node.type, title: node.title, status, result };
}

async function publishGoogleReply({ reviewName, replyHtml, replyId, reviewId, accessToken }: { reviewName: string; replyHtml: string; replyId: string; reviewId: string; accessToken: string }) {
  const supabase = createSupabaseAdminClient();
  const plainReply = hansHtmlToPlainText(replyHtml);
  const publishResponse = await fetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
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
  await updateReviewStatus(reviewId, "published_auto");
}

function getGoogleReviewerName(review: GoogleReview) {
  return review.reviewer?.isAnonymous ? "Client Google" : review.reviewer?.displayName ?? "Client Google";
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
  reviewText,
  tone
}: {
  merchant: MerchantRow;
  review: GoogleReview;
  rating: number;
  reviewText: string;
  tone?: string;
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
        `Ton demandé par le scénario : ${tone ?? merchant.response_tone ?? "chaleureux"}`,
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
