import { listAutomationExecutionLogs, listStoredAutomationFlows, saveAutomationExecutionLog, type StoredAutomationFlow } from "@/lib/automation-execution-store";
import { getEmailingDashboardData } from "@/lib/emailing-data";
import { generateEmailWithHans } from "@/lib/emailing-hans";
import { dispatchEmailCampaign } from "@/lib/emailing-provider";
import { createEmailCampaign, createEmailRecipients } from "@/lib/emailing-store";
import type { EmailCampaignRecord } from "@/lib/emailing-types";
import { createTriggeredSocialDraft } from "@/lib/social-automation";
import { publishPostToInstagram } from "@/lib/social-publish";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export type AutomationEvent = {
  merchantId: string;
  id: string;
  type: "new_customer" | "new_visit" | "new_reward";
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

  const matchingFlows = flows.filter((flow) => flow.status === "active" && flow.nodes.some((node) => node.type === event.type));
  const completed = new Set(logs.filter((log) => log.review_name === event.id && log.flow_id && ["published", "drafted", "skipped"].includes(log.status)).map((log) => log.flow_id));
  const results = [];

  for (const flow of matchingFlows) {
    if (completed.has(flow.id)) continue;
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
  let current = flow.nodes.find((node) => node.type === event.type);
  const visited = new Set<string>();
  const steps: EventStep[] = [];
  let emailCampaign: EmailCampaignRecord | null = null;
  let socialPost: SocialPostRow | null = null;

  try {
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      let branch: "default" | "yes" | "no" = "default";

      if (current.category === "trigger") {
        steps.push(toStep(current, "success", triggerResult(event.type)));
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
        const { error } = await supabase.from("notifications").insert({ merchant_id: merchant.id, title: flow.title, body, type: "hans_task_done", read: false });
        if (error) throw new Error(error.message);
        steps.push(toStep(current, "success", "Notification envoyée au commerçant."));
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
    if (current && !steps.some((step) => step.node_id === current?.id && step.status === "error")) steps.push(toStep(current, "error", message));
    return { status: "error" as const, message, steps };
  }
}

function evaluateCondition(node: StoredAutomationFlow["nodes"][number], event: AutomationEvent) {
  if (node.type === "marketing_consent") return event.customer.consentEmail;
  if (node.type === "reward_count") return event.customer.rewards >= Number(node.config.count ?? 1);
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

function triggerResult(type: AutomationEvent["type"]) {
  if (type === "new_customer") return "Nouvelle inscription RCU reçue.";
  if (type === "new_visit") return "Nouvelle visite RCU validée.";
  return "Nouvelle récompense RCU gagnée.";
}

function eventSummary(event: AutomationEvent) {
  return `${triggerResult(event.type)} Client : ${event.customer.firstName} ${event.customer.lastName}.`;
}

function getApplicationOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000";
}
