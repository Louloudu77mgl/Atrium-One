import { listAutomationExecutionLogs, listStoredAutomationFlows, saveAutomationExecutionLog, type StoredAutomationFlow } from "@/lib/automation-execution-store";
import { getEmailingDashboardData } from "@/lib/emailing-data";
import { generateEmailWithHans } from "@/lib/emailing-hans";
import { dispatchEmailCampaign } from "@/lib/emailing-provider";
import { createEmailCampaign, createEmailRecipients } from "@/lib/emailing-store";
import type { EmailCampaignRecord } from "@/lib/emailing-types";
import { createTriggeredSocialDraft } from "@/lib/social-automation";
import { getValidInstagramAccessToken } from "@/lib/instagram-tokens";
import { getInstagramPublishErrorDetails, publishPostToInstagram } from "@/lib/social-publish";
import { createMerchantNotification } from "@/lib/merchant-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export type AutomationEvent = {
  merchantId: string;
  id: string;
  type: "new_customer" | "new_visit" | "new_reward" | "reward_used" | "customer_inactive" | "customer_birthday" | "registration_anniversary";
  occurredAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    consentEmail: boolean;
    consentSms: boolean;
    source: "RCU" | "Site web" | "Caisse";
    rewards: number;
  };
  details?: Record<string, string | number | boolean | null>;
};

type EventStep = NonNullable<Parameters<typeof saveAutomationExecutionLog>[0]["steps"]>[number];

export async function runAutomationEvent(event: AutomationEvent) {
  const supabase = createSupabaseAdminClient();
  const [{ data: merchant, error: merchantError }, flows, logs] = await Promise.all([
    supabase.from("merchants").select("*").eq("id", event.merchantId).maybeSingle(),
    listStoredAutomationFlows(event.merchantId),
    listAutomationExecutionLogs(event.merchantId, 500)
  ]);
  if (merchantError) throw new Error(merchantError.message);
  if (!merchant) throw new Error("Commerce introuvable pour cette automatisation.");

  const matchingFlows = flows.filter((flow) => flow.status === "active" && flow.nodes.some((node) => node.category === "trigger" && matchesEventTrigger(node, event)));
  const completed = new Set(logs.filter((log) => log.review_name === event.id && log.flow_id && ["published", "drafted", "skipped"].includes(log.status)).map((log) => log.flow_id));
  const results = [];

  for (const flow of matchingFlows) {
    if (completed.has(flow.id)) continue;
    if (isFlowCoolingDown(flow, logs, event)) {
      await saveAutomationExecutionLog({
        merchant_id: event.merchantId,
        automation_key: "flow_event",
        review_name: event.id,
        customer_name: `${event.customer.firstName} ${event.customer.lastName}`.trim(),
        status: "skipped",
        message: "Scénario ignoré pendant sa période de repos.",
        flow_id: flow.id,
        flow_title: flow.title,
        steps: []
      });
      continue;
    }
    const result = await executeEventFlow({ merchant, flow, event });
    await saveAutomationExecutionLog({
      merchant_id: event.merchantId,
      automation_key: "flow_event",
      review_name: event.id,
      customer_name: `${event.customer.firstName} ${event.customer.lastName}`.trim(),
      status: result.status,
      message: result.message,
      flow_id: flow.id,
      flow_title: flow.title,
      steps: result.steps
    });
    results.push({ flowId: flow.id, ...result });
  }

  return results;
}

async function executeEventFlow({ merchant, flow, event }: { merchant: MerchantRow; flow: StoredAutomationFlow; event: AutomationEvent }) {
  const supabase = createSupabaseAdminClient();
  const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
  let current = flow.nodes.find((node) => node.category === "trigger" && matchesEventTrigger(node, event));
  const visited = new Set<string>();
  const steps: EventStep[] = [];
  let emailCampaign: EmailCampaignRecord | null = null;
  let socialPost: SocialPostRow | null = null;

  try {
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      let branch: "default" | "yes" | "no" = "default";

      if (current.category === "trigger") {
        steps.push(toStep(current, "success", triggerResult(current.type, event.type)));
      } else if (current.category === "condition") {
        const matched = evaluateCondition(current, event);
        branch = matched ? "yes" : "no";
        steps.push(toStep(current, "success", matched ? "Condition validée : branche Oui." : "Condition non validée : branche Non."));
      } else if (current.type === "generate_email" || current.type === "prepare_newsletter") {
        emailCampaign = await buildEventEmail({ merchant, event, node: current });
        steps.push(toStep(current, "success", `E-mail « ${emailCampaign.content.subject} » créé pour ${event.customer.email ?? "le client"}.`));
      } else if (current.type === "send_email" || current.type === "send_newsletter") {
        if (!event.customer.consentEmail || !event.customer.email) {
          steps.push(toStep(current, "skipped", "E-mail non envoyé : adresse ou consentement e-mail absent."));
        } else {
          emailCampaign ??= await buildEventEmail({ merchant, event, node: current });
          if (current.mode !== "automatic") {
            steps.push(toStep(current, "waiting", "E-mail conservé en brouillon conformément au réglage de cette card."));
            return { status: "drafted" as const, message: "E-mail créé et placé dans les brouillons.", steps };
          }
          emailCampaign = await dispatchEmailCampaign({ campaign: emailCampaign, merchant, origin: getApplicationOrigin(), supabaseClient: supabase });
          steps.push(toStep(current, "success", `E-mail envoyé à ${event.customer.email}.`));
        }
      } else if (current.type === "prepare_instagram") {
        socialPost = await createTriggeredSocialDraft({ merchant, theme: String(current.config.theme ?? "Actualité client"), source: eventSummary(event), supabaseClient: supabase });
        steps.push(toStep(current, "success", `Brouillon Instagram « ${socialPost.title} » créé.`));
      } else if (current.type === "publish_instagram") {
        if (!socialPost) throw new Error("Ajoutez une card de préparation Instagram avant la publication.");
        if (current.mode !== "automatic") {
          steps.push(toStep(current, "waiting", "Publication Instagram conservée en brouillon."));
          return { status: "drafted" as const, message: "Publication Instagram prête à valider.", steps };
        }
        socialPost = await publishPostToInstagram({ merchant, post: socialPost, supabaseClient: supabase });
        steps.push(toStep(current, "success", "Publication publiée sur Instagram."));
      } else if (current.type === "notify_merchant") {
        const body = String(current.config.message ?? `${flow.title} vient de s’exécuter.`);
        const storage = await createMerchantNotification({ supabase, merchantId: merchant.id, title: flow.title, body });
        steps.push(toStep(
          current,
          "success",
          storage === "notification"
            ? "Notification envoyée au commerçant."
            : "Notification enregistrée dans l’historique de l’automatisation."
        ));
      } else if (current.type === "request_human_validation") {
        const body = String(current.config.message ?? `${flow.title} attend votre validation.`);
        await createMerchantNotification({ supabase, merchantId: merchant.id, title: `Validation · ${flow.title}`, body });
        steps.push(toStep(current, "waiting", "Validation demandée au commerçant."));
        return { status: "drafted" as const, message: "Le scénario attend une validation humaine.", steps };
      } else if (current.type === "schedule_instagram") {
        if (!socialPost) throw new Error("Ajoutez une card de préparation Instagram avant la planification.");
        const { connection } = await getValidInstagramAccessToken({ merchantId: merchant.id, supabaseClient: supabase });
        const delayHours = Math.max(1, Number(current.config.delay_hours ?? 24));
        const scheduledAt = new Date(Date.now() + delayHours * 3_600_000).toISOString();
        const scheduleResult = await supabase.from("social_posts").update({
          status: "scheduled",
          scheduled_at: scheduledAt,
          instagram_connection_id: connection.id,
          failed_at: null,
          failure_code: null,
          error_message: null,
          retry_count: 0,
          updated_at: new Date().toISOString()
        }).eq("id", socialPost.id).select("*").single();
        if (scheduleResult.error) throw new Error(scheduleResult.error.message);
        socialPost = scheduleResult.data as SocialPostRow;
        steps.push(toStep(current, "success", `Publication planifiée dans ${delayHours} heure(s).`));
      } else if (current.type === "allowed_window") {
        if (!isWithinAllowedWindow(current.config)) {
          steps.push(toStep(current, "skipped", "Événement reçu hors de la plage horaire autorisée."));
          return { status: "skipped" as const, message: "Scénario arrêté hors de la plage horaire autorisée.", steps };
        }
        steps.push(toStep(current, "success", "Plage horaire autorisée."));
      } else if (current.type === "cooldown") {
        steps.push(toStep(current, "success", "Période de repos appliquée aux prochains événements de ce client."));
      } else if (current.type === "limit_once") {
        steps.push(toStep(current, "success", "Exécution unique garantie pour ce client et cet événement."));
      } else if (current.type === "stop_flow") {
        steps.push(toStep(current, "skipped", "Scénario arrêté par cette card."));
        return { status: "skipped" as const, message: "Scénario arrêté conformément au flow.", steps };
      } else {
        throw new Error(`La card « ${current.title} » n’est pas compatible avec le déclencheur ${event.type}.`);
      }

      const edge = flow.edges.find((candidate) => candidate.source === current?.id && candidate.branch === branch);
      current = edge ? nodesById.get(edge.target) : undefined;
    }

    if (emailCampaign?.status === "draft" || (socialPost && socialPost.status !== "published")) {
      return { status: "drafted" as const, message: `Scénario « ${flow.title} » exécuté ; un contenu est prêt dans les brouillons.`, steps };
    }
    return { status: "published" as const, message: `Scénario « ${flow.title} » exécuté jusqu’au bout.`, steps };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    const integration = getInstagramPublishErrorDetails(error);
    if (integration) {
      await createMerchantNotification({
        supabase,
        merchantId: merchant.id,
        title: "Publication Instagram interrompue",
        body: "Reconnectez Instagram puis relancez cette automatisation."
      });
    }
    if (current && !steps.some((step) => step.node_id === current?.id && step.status === "error")) {
      const errorStep = toStep(current, "error", message);
      if (integration) errorStep.integration = integration;
      steps.push(errorStep);
    }
    return { status: "error" as const, message, steps };
  }
}

function evaluateCondition(node: StoredAutomationFlow["nodes"][number], event: AutomationEvent) {
  if (node.type === "marketing_consent") return event.customer.consentEmail;
  if (node.type === "reward_count") return event.customer.rewards >= Number(node.config.count ?? 1);
  if (node.type === "visit_comparison") return Number(event.details?.visits ?? 0) >= Number(node.config.visits ?? 5);
  if (node.type === "points_comparison") return Number(event.details?.points ?? 0) >= Number(node.config.points ?? 100);
  if (node.type === "last_visit_age") {
    const previousVisitAt = typeof event.details?.previousVisitAt === "string" ? new Date(event.details.previousVisitAt) : null;
    const occurredAt = new Date(event.occurredAt);
    if (!previousVisitAt || Number.isNaN(previousVisitAt.getTime()) || Number.isNaN(occurredAt.getTime())) return false;
    const elapsedDays = Math.floor((occurredAt.getTime() - previousVisitAt.getTime()) / 86_400_000);
    return elapsedDays >= Number(node.config.days ?? 30);
  }
  if (node.type === "customer_contact_field") {
    return String(node.config.field ?? "E-mail") === "Téléphone" ? Boolean(event.customer.phone) : Boolean(event.customer.email);
  }
  if (node.type === "customer_status") {
    const visits = Number(event.details?.visits ?? 0);
    const daysSincePreviousVisit = getDaysSincePreviousVisit(event);
    const status = String(node.config.status ?? "Fidèle");
    if (status === "Nouveau") return visits <= 1;
    if (status === "Régulier") return visits >= 2 && visits < 5;
    if (status === "Inactif") return daysSincePreviousVisit >= 30;
    return visits >= 5;
  }
  if (node.type === "segment_match") return String(node.config.segment ?? "").toLocaleLowerCase("fr-FR").includes("rcu") && event.customer.source === "RCU";
  return false;
}

async function buildEventEmail({ merchant, event, node }: { merchant: MerchantRow; event: AutomationEvent; node: StoredAutomationFlow["nodes"][number] }) {
  if (!event.customer.email || !event.customer.consentEmail) throw new Error("Ce client n’a pas consenti à recevoir des e-mails.");
  const dashboard = await getEmailingDashboardData(merchant, [], createSupabaseAdminClient());
  const goal = String(node.config.goal ?? `Souhaiter la bienvenue à ${event.customer.firstName}`);
  const content = await generateEmailWithHans({ merchant, brand: dashboard.brand, brief: goal, campaignType: event.type === "new_customer" ? "loyalty" : "other", segmentLabel: event.customer.firstName });
  if (node.config.subject) content.subject = String(node.config.subject).slice(0, 120);
  const recipients = createEmailRecipients([{ id: event.customer.id, email: event.customer.email, firstName: event.customer.firstName, lastName: event.customer.lastName }]);
  return createEmailCampaign({
    merchant_id: merchant.id,
    name: content.subject,
    campaign_type: event.type === "new_customer" ? "loyalty" : "other",
    brief: goal,
    segment_rules: [{ id: "registered_via_rcu" }],
    segment_mode: "all",
    segment_label: `Client déclencheur : ${event.customer.firstName}`,
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
}

function toStep(node: StoredAutomationFlow["nodes"][number], status: EventStep["status"], result: string): EventStep {
  return { node_id: node.id, node_type: node.type, title: node.title, status, result };
}

function triggerResult(nodeType: string, eventType: AutomationEvent["type"]) {
  const labels: Record<string, string> = {
    customer_returned: "Retour du client détecté après la période d'absence.",
    visit_milestone: "Palier de visites atteint.",
    points_milestone: "Palier de points franchi.",
    profile_completed: "Profil RCU complet détecté.",
    consent_granted: "Consentements marketing valides.",
    game_participation: "Participation au jeu RCU validée.",
    game_reward_won: "Gain RCU détecté.",
    reward_used: "Utilisation réelle d'une récompense détectée.",
    near_reward: "Le client est proche de sa prochaine récompense.",
    customer_inactive: "Période d'inactivité client atteinte.",
    customer_birthday: "Anniversaire du client détecté aujourd'hui.",
    registration_anniversary: "Anniversaire de l'inscription RCU détecté.",
    visit_velocity: "Fréquence de visite cible atteinte."
  };
  if (labels[nodeType]) return labels[nodeType];
  if (eventType === "new_customer") return "Nouvelle inscription RCU reçue.";
  if (eventType === "new_visit") return "Nouvelle visite RCU validée.";
  return "Nouvelle récompense RCU gagnée.";
}

function eventSummary(event: AutomationEvent) {
  return `${triggerResult(event.type, event.type)} Client : ${event.customer.firstName} ${event.customer.lastName}.`;
}

function matchesEventTrigger(node: StoredAutomationFlow["nodes"][number], event: AutomationEvent) {
  if (node.type === "customer_inactive" && event.type === "customer_inactive") return Number(event.details?.inactivityDays ?? 0) >= Math.max(1, Number(node.config.days ?? 30));
  if (node.type === event.type) return true;
  if (node.type === "customer_returned" && event.type === "new_visit") return getDaysSincePreviousVisit(event) >= Math.max(1, Number(node.config.days ?? 30));
  if (node.type === "visit_milestone" && event.type === "new_visit") return Number(event.details?.visits ?? 0) === Math.max(1, Number(node.config.visits ?? 5));
  if (node.type === "points_milestone" && event.type === "new_visit") {
    const threshold = Math.max(1, Number(node.config.points ?? 100));
    return Number(event.details?.points ?? 0) >= threshold && Number(event.details?.previousPoints ?? 0) < threshold;
  }
  if (node.type === "profile_completed" && event.type === "new_customer") return event.details?.profileComplete === true;
  if (node.type === "consent_granted" && event.type === "new_customer") return event.customer.consentEmail && event.customer.consentSms;
  if (node.type === "game_participation" && event.type === "new_visit") return ["wheel", "raffle"].includes(String(event.details?.formType ?? ""));
  if (node.type === "game_reward_won" && event.type === "new_reward") return ["wheel", "raffle"].includes(String(event.details?.formType ?? ""));
  if (node.type === "near_reward" && event.type === "new_visit") {
    const missing = Number(event.details?.pointsToNextReward);
    return Number.isFinite(missing) && missing > 0 && missing <= Math.max(1, Number(node.config.points ?? 25));
  }
  if (node.type === "visit_velocity" && event.type === "new_visit") {
    const days = Math.max(1, Number(node.config.days ?? 30));
    const visits = Math.max(1, Number(node.config.visits ?? 3));
    const occurredAt = new Date(event.occurredAt).getTime();
    const visitCount = String(event.details?.visitDays ?? "").split(",").filter((day) => {
      const timestamp = new Date(`${day}T12:00:00Z`).getTime();
      return Number.isFinite(timestamp) && occurredAt - timestamp <= days * 86_400_000;
    }).length;
    return visitCount === visits;
  }
  return false;
}

function getDaysSincePreviousVisit(event: AutomationEvent) {
  const previousVisitAt = typeof event.details?.previousVisitAt === "string" ? new Date(event.details.previousVisitAt).getTime() : Number.NaN;
  const occurredAt = new Date(event.occurredAt).getTime();
  return Number.isFinite(previousVisitAt) && Number.isFinite(occurredAt) ? Math.floor((occurredAt - previousVisitAt) / 86_400_000) : -1;
}

function isFlowCoolingDown(flow: StoredAutomationFlow, logs: Awaited<ReturnType<typeof listAutomationExecutionLogs>>, event: AutomationEvent) {
  const cooldown = flow.nodes.find((node) => node.type === "cooldown");
  if (!cooldown) return false;
  const days = Math.max(1, Number(cooldown.config.days ?? 7));
  const customerName = `${event.customer.firstName} ${event.customer.lastName}`.trim();
  const since = Date.now() - days * 86_400_000;
  return logs.some((log) => log.flow_id === flow.id && log.customer_name === customerName && new Date(log.created_at).getTime() >= since && ["published", "drafted"].includes(log.status));
}

function isWithinAllowedWindow(config: Record<string, string | number | boolean>) {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", hour12: false, timeZone: "Europe/Paris" }).format(new Date()));
  const start = Math.max(0, Math.min(23, Number(config.start_hour ?? 8)));
  const end = Math.max(0, Math.min(23, Number(config.end_hour ?? 20)));
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

function getApplicationOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000";
}
