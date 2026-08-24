import { getGoogleOAuthConfig } from "@/lib/google-oauth";
import { HANS_REVIEW_REPLY_INSTRUCTIONS } from "@/lib/hans-review-reply-prompt";
import {
  listAutomationExecutionLogs,
  listStoredAutomationFlows,
  saveAutomationExecutionLog,
  type StoredAutomationFlow
} from "@/lib/automation-execution-store";
import { hansHtmlToPlainText, sanitizeHansHtml } from "@/lib/sanitize-hans-html";
import { createTriggeredSocialDraft } from "@/lib/social-automation";
import { publishPostToInstagram } from "@/lib/social-publish";
import { getEmailingDashboardData } from "@/lib/emailing-data";
import { generateEmailWithHans } from "@/lib/emailing-hans";
import { createEmailCampaign, createEmailRecipients } from "@/lib/emailing-store";
import { dispatchEmailCampaign } from "@/lib/emailing-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EmailCampaignRecord } from "@/lib/emailing-types";
import type { GoogleConnectionRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";

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
  const { data: connections, error: connectionsError } = await supabase
    .from("google_connections")
    .select("merchant_id")
    .eq("status", "connected")
    .order("updated_at", { ascending: true });

  if (connectionsError) {
    throw new Error(connectionsError.message);
  }

  const results: AutomationResult[] = [];

  for (const connection of connections ?? []) {
    if (results.filter((result) => result.status !== "skipped").length >= limit) {
      break;
    }

    const available = Math.max(0, limit - results.filter((result) => result.status !== "skipped").length);
    results.push(...await runReviewAutomationsForMerchant(connection.merchant_id, available));
  }

  return results;
}

export async function runReviewAutomationsForMerchant(merchantId: string, limit = 5) {
  const supabase = createSupabaseAdminClient();
  let results: AutomationResult[];

  try {
    const [{ data: merchant, error: merchantError }, { data: connection, error: connectionError }, storedFlows, executionLogs] = await Promise.all([
      supabase.from("merchants").select("*").eq("id", merchantId).maybeSingle(),
      supabase.from("google_connections").select("*").eq("merchant_id", merchantId).eq("status", "connected").maybeSingle(),
      listStoredAutomationFlows(merchantId).catch(() => []),
      listAutomationExecutionLogs(merchantId, 500).catch(() => [])
    ]);

    if (merchantError) throw new Error(merchantError.message);
    if (connectionError) throw new Error(connectionError.message);

    const activeReviewFlows = storedFlows
      .filter((flow) => flow.status === "active" && flow.nodes.some((node) => node.type === "google_review"))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    if (!activeReviewFlows.length) {
      results = [{ merchant_id: merchantId, status: "skipped", message: "Aucun scénario Avis actif n’est enregistré pour ce compte." }];
    } else if (!merchant || !connection?.google_location_id) {
      results = [{ merchant_id: merchantId, status: "skipped", message: "Google Business non connecté." }];
    } else {
      const completedExecutions = new Set(
        executionLogs
          .filter((log) => log.review_name && log.flow_id && ["published", "drafted", "skipped"].includes(log.status))
          .map((log) => `${log.review_name}:${log.flow_id}`)
      );
      results = await processMerchantReviews({ merchant, connection, flows: activeReviewFlows, completedExecutions, limit });
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
  flows,
  completedExecutions,
  limit
}: {
  merchant: MerchantRow;
  connection: GoogleConnectionRow;
  flows: StoredAutomationFlow[];
  completedExecutions: Set<string>;
  limit: number;
}) {
  const supabase = createSupabaseAdminClient();
  const accessToken = await refreshGoogleAccessToken(connection);
  await supabase
    .from("google_connections")
    .update({ access_token_encrypted: accessToken, status: "connected" })
    .eq("merchant_id", merchant.id);

  const reviews = await listGoogleReviews(accessToken, connection.google_location_id as string);
  const candidates = reviews
    .filter((review) => !review.reviewReply?.comment && review.name && review.createTime)
    .sort((left, right) => new Date(left.createTime as string).getTime() - new Date(right.createTime as string).getTime())
    .slice(0, limit);
  const results: AutomationResult[] = [];

  for (const review of candidates) {
    try {
      const rating = ratings[review.starRating ?? ""] ?? 3;
      const plans = flows
        .filter((flow) => !completedExecutions.has(`${review.name}:${flow.id}`))
        .map((flow) => buildReviewFlowPlan(flow, rating))
        .filter((plan) => plan.action !== "disabled");
      if (!plans.length) {
        const alreadyHandled = flows.some((flow) => completedExecutions.has(`${review.name}:${flow.id}`));
        results.push({
          merchant_id: merchant.id,
          review_name: review.name,
          customer_name: getGoogleReviewerName(review),
          rating,
          status: "skipped",
          message: alreadyHandled
            ? "Cet avis a déjà été traité par les scénarios actifs."
            : "Aucun chemin connecté des scénarios actifs ne correspond à cet avis."
        });
        continue;
      }
      for (const plan of plans) {
        results.push(await processGoogleReview({ merchant, review, accessToken, plan }));
      }
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
  const replyAlreadyPublished = Boolean(existingReply && ["published", "published_auto", "published_manual"].includes(existingReply.status));
  if (existingReply && plan.action === "validation") {
    return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "skipped", message: "Réponse déjà préparée et en attente de l’action prévue dans le flow.", flow_id: plan.flow.id, flow_title: plan.flow.title };
  }

  let replyHtml = existingReply?.reply_text ?? null;
  let replyId = existingReply?.id;
  let googlePublished = false;
  let socialPost: SocialPostRow | null = null;
  let emailCampaign: EmailCampaignRecord | null = null;
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
      const body = String(node.config.message ?? "Une automatisation Avis nécessite votre attention.");
      const notification = await supabase.from("notifications").insert({ merchant_id: merchant.id, title: plan.flow.title, body, type: "hans_task_done", read: false });
      if (notification.error) throw new Error(notification.error.message);
      steps.push(step(node, "success", "Notification créée dans AtriumOne."));
      continue;
    }

    if (node.type === "limit_once") {
      steps.push(step(node, "success", "Exécution unique garantie pour cet avis et ce scénario."));
      continue;
    }

    if (node.type === "publish_review_reply") {
      if (!replyHtml || !replyId) throw new Error("Le flow tente de publier avant que Hans ait généré une réponse.");
      if (replyAlreadyPublished || googlePublished) {
        steps.push(step(node, "skipped", "Une réponse est déjà publiée sur Google ; aucune double publication."));
        continue;
      }
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
      googlePublished = true;
      steps.push(step(node, "success", "Réponse publiée sur Google."));
      continue;
    }

    if (node.type === "prepare_instagram") {
      try {
        socialPost = await createTriggeredSocialDraft({
          merchant,
          theme: String(node.config.theme ?? "Avis client"),
          source: `Avis Google ${rating}/5 : ${reviewText}`,
          supabaseClient: supabase
        });
        steps.push(step(node, "success", `Brouillon Instagram « ${socialPost.title} » créé.`));
      } catch (error) {
        socialPost = null;
        steps.push(step(node, "error", error instanceof Error ? error.message : "Préparation Instagram impossible."));
      }
      continue;
    }

    if (node.type === "publish_instagram") {
      if (!socialPost) {
        steps.push(step(node, "skipped", "Publication Instagram ignorée car aucun brouillon n’a pu être préparé."));
        continue;
      }
      if (node.mode !== "automatic") {
        steps.push(step(node, "waiting", "Publication Instagram enregistrée en brouillon, conformément au mode de cette card."));
        continue;
      }
      try {
        socialPost = await publishPostToInstagram({ merchant, post: socialPost, supabaseClient: supabase });
        steps.push(step(node, "success", "Publication publiée sur Instagram."));
      } catch (error) {
        steps.push(step(node, "error", error instanceof Error ? error.message : "Publication Instagram impossible."));
      }
      continue;
    }

    if (node.type === "generate_email") {
      try {
        const dashboard = await getEmailingDashboardData(merchant, [], supabase);
        const goal = String(node.config.goal ?? "Partager une actualité avec les clients");
        const content = await generateEmailWithHans({
          merchant,
          brand: dashboard.brand,
          brief: `${goal}. Point de départ : un avis Google ${rating}/5 vient d’être reçu.`,
          campaignType: goal.toLocaleLowerCase("fr-FR").includes("réactiv") ? "reactivation" : "newsletter",
          segmentLabel: "Tous les clients consentants"
        });
        const configuredSubject = plan.nodes.find((candidate) => candidate.type === "send_email")?.config.subject;
        if (configuredSubject) content.subject = String(configuredSubject).slice(0, 120);
        const recipients = createEmailRecipients(dashboard.subscribers);
        emailCampaign = await createEmailCampaign({
          merchant_id: merchant.id,
          name: content.subject,
          campaign_type: goal.toLocaleLowerCase("fr-FR").includes("réactiv") ? "reactivation" : "newsletter",
          brief: goal,
          segment_rules: [{ id: "all_customers" }],
          segment_mode: "all",
          segment_label: "Tous les clients consentants",
          recipient_count: recipients.length,
          recipients,
          content,
          status: "draft",
          scheduled_at: null,
          sent_at: null,
          sent_count: 0,
          open_count: 0,
          click_count: 0,
          open_rate: 0,
          click_rate: 0,
          provider_message_ids: [],
          error_message: null
        });
        steps.push(step(node, "success", `E-mail « ${content.subject} » généré pour ${recipients.length} client(s) consentant(s).`));
      } catch (error) {
        emailCampaign = null;
        steps.push(step(node, "error", error instanceof Error ? error.message : "Génération de l’e-mail impossible."));
      }
      continue;
    }

    if (node.type === "send_email") {
      if (!emailCampaign) {
        try {
          const dashboard = await getEmailingDashboardData(merchant, [], supabase);
          const goal = String(node.config.goal ?? "Partager une information avec les clients consentants");
          const content = await generateEmailWithHans({ merchant, brand: dashboard.brand, brief: goal, campaignType: "other", segmentLabel: "Tous les clients consentants" });
          if (node.config.subject) content.subject = String(node.config.subject).slice(0, 120);
          const recipients = createEmailRecipients(dashboard.subscribers);
          emailCampaign = await createEmailCampaign({
            merchant_id: merchant.id,
            name: content.subject,
            campaign_type: "other",
            brief: goal,
            segment_rules: [{ id: "all_customers" }],
            segment_mode: "all",
            segment_label: "Tous les clients consentants",
            recipient_count: recipients.length,
            recipients,
            content,
            status: "draft",
            scheduled_at: null,
            sent_at: null,
            sent_count: 0,
            open_count: 0,
            click_count: 0,
            open_rate: 0,
            click_rate: 0,
            provider_message_ids: [],
            error_message: null
          });
          steps.push(step(node, "success", `E-mail « ${content.subject} » créé pour ${recipients.length} client(s) consentant(s).`));
        } catch (error) {
          steps.push(step(node, "error", error instanceof Error ? error.message : "Création de l’e-mail impossible."));
          continue;
        }
      }
      if (node.mode !== "automatic") {
        steps.push(step(node, "waiting", "E-mail conservé en brouillon, conformément au mode de cette card."));
        continue;
      }
      if (!emailCampaign.recipients.length) {
        steps.push(step(node, "waiting", "Aucun client consentant : la campagne reste en brouillon."));
        continue;
      }
      try {
        emailCampaign = await dispatchEmailCampaign({
          campaign: emailCampaign,
          merchant,
          origin: getApplicationOrigin(),
          supabaseClient: supabase
        });
        steps.push(step(node, "success", `E-mail envoyé à ${emailCampaign.sent_count} client(s).`));
      } catch (error) {
        steps.push(step(node, "error", error instanceof Error ? error.message : "Envoi de l’e-mail impossible."));
      }
      continue;
    }

    if (node.type === "stop_flow") {
      steps.push(step(node, "skipped", "Scénario arrêté par cette card."));
      return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "skipped", message: "Scénario arrêté par le flow.", flow_id: plan.flow.id, flow_title: plan.flow.title, steps };
    }

    throw new Error(`La card « ${node.title} » (${node.type}) n’a pas d’exécuteur compatible avec le déclencheur Avis Google.`);
    }

    if (googlePublished) {
      const waitingCount = steps.filter((current) => current.status === "waiting").length;
      const errorCount = steps.filter((current) => current.status === "error").length;
      const details = [
        waitingCount ? `${waitingCount} action(s) attendent une validation` : "",
        errorCount ? `${errorCount} action(s) en erreur` : ""
      ].filter(Boolean).join(" ; ");
      return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "published", message: details ? `Réponse Google publiée ; ${details}.` : `Scénario « ${plan.flow.title} » exécuté jusqu’au bout.`, flow_id: plan.flow.id, flow_title: plan.flow.title, steps };
    }

    if (replyAlreadyPublished) {
      return { merchant_id: merchant.id, local_review_id: localReview.id, review_name: review.name, customer_name: getGoogleReviewerName(review), rating, status: "published", message: `Scénario « ${plan.flow.title} » exécuté ; la réponse Google existante n’a pas été republiée.`, flow_id: plan.flow.id, flow_title: plan.flow.title, steps };
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

function getApplicationOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000";
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
      instructions: HANS_REVIEW_REPLY_INSTRUCTIONS,
      input: [
        `Commerce : ${merchant.business_name}`,
        `Activité : ${merchant.business_type}`,
        `Client : ${author}`,
        `Note : ${rating}/5`,
        `Avis : ${reviewText}`,
        `Ton demandé par le scénario : ${tone ?? merchant.response_tone ?? "chaleureux"}`
      ].join("\n"),
      max_output_tokens: 300
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
