"use client";

import type { AutomationEdge, AutomationFlow, AutomationNodeData, NodeLibraryItem } from "./types";

const purple = "#6E4DE0";
const green = "#2E9E5B";
const amber = "#D18A1D";
const slate = "#6E6A76";
const red = "#C2492F";

export const NODE_LIBRARY: Array<{ title: string; category: string; items: NodeLibraryItem[] }> = [
  {
    title: "Déclencheurs",
    category: "trigger",
    items: [
      item("new_customer", "trigger", "Nouveau client inscrit au RCU", "Se déclenche immédiatement lors de la première inscription d’un client au RCU.", "sparkle", purple, [], { source: "RCU" }, undefined, undefined, "CRM", ["clients", "crm"]),
      item("new_visit", "trigger", "Nouvelle visite RCU validée", "Se déclenche immédiatement quand une nouvelle visite RCU est enregistrée.", "store", purple, [], {}, undefined, undefined, "Commerce", ["commerce", "clients"]),
      item("new_reward", "trigger", "Nouvelle récompense gagnée", "Quand un client gagne une récompense.", "party", purple, [], {}, undefined, undefined, "CRM", ["crm", "clients"]),
      item("google_review", "trigger", "Veille des avis Google", "Recherche les nouveaux avis au rythme choisi, puis lance ce scénario uniquement lors d’une veille prévue.", "star", purple, [
        { key: "interval_count", label: "Tous les", type: "number" },
        { key: "interval_unit", label: "Période", type: "select", options: ["jour(s)", "semaine(s)"] }
      ], { interval_count: 1, interval_unit: "jour(s)" }, undefined, undefined, "Google", ["google", "avis", "veille"])
    ]
  },
  {
    title: "Conditions",
    category: "condition",
    items: [
      item("marketing_consent", "condition", "Client a accepté les emails marketing", "Évite de contacter les clients sans consentement.", "lock", green, [], {}, undefined, ["yes", "no"], "Emails", ["conditions", "emails"]),
      item("review_rating_gte", "condition", "Note de l’avis supérieure ou égale à X", "Filtre les avis selon leur note.", "star", green, [{ key: "rating", label: "Note minimale", type: "number" }], { rating: 4 }, undefined, ["yes", "no"], "Google", ["conditions", "google", "avis"]),
      item("reward_count", "condition", "Client a gagné au moins X récompenses", "Vérifie le nombre réel de récompenses du client dans le RCU.", "party", green, [{ key: "count", label: "Nombre minimum", type: "number" }], { count: 2 }, undefined, ["yes", "no"], "CRM", ["conditions", "crm"])
    ]
  },
  {
    title: "Actions",
    category: "action",
    items: [
      item("send_email", "action", "Envoyer un e-mail au client", "Génère si nécessaire puis envoie un e-mail au client qui a déclenché le flow.", "mail", amber, [{ key: "subject", label: "Objet", type: "text" }, { key: "goal", label: "Message à transmettre", type: "text" }], { subject: "Bienvenue !", goal: "Souhaiter la bienvenue au nouveau client" }, "automatic", undefined, "Emails", ["emails"]),
      item("generate_email", "action", "Préparer un e-mail avec Hans", "Hans crée un e-mail personnalisé pour le client du flow.", "sparkle", amber, [{ key: "goal", label: "Objectif", type: "text" }], { goal: "Souhaiter la bienvenue au client" }, "automatic", undefined, "Actions IA", ["ia", "emails"]),
      item("prepare_instagram", "action", "Préparer une publication Instagram", "Hans rédige le texte et prépare le visuel.", "sparkle", amber, [{ key: "theme", label: "Thème", type: "text" }], { theme: "Nouveautés" }, "semi_automatic", undefined, "Instagram", ["instagram", "ia"]),
      item("publish_instagram", "action", "Publier sur Instagram", "Publie le contenu sur Instagram.", "phone", amber, [], {}, "automatic", undefined, "Instagram", ["instagram"]),
      item("generate_review_reply", "action", "Générer une réponse à un avis", "Hans prépare une réponse adaptée à l’avis.", "sparkle", amber, [{ key: "tone", label: "Ton", type: "select", options: ["Chaleureux", "Professionnel", "Premium"] }], { tone: "Chaleureux" }, "semi_automatic", undefined, "Google", ["google", "avis", "ia"]),
      item("publish_review_reply", "action", "Publier une réponse à un avis", "Publie la réponse sur Google.", "message", amber, [], {}, "automatic", undefined, "Google", ["google", "avis"]),
      item("notify_merchant", "action", "Notifier le commerçant", "Crée une notification réelle dans AtriumOne.", "bell", amber, [{ key: "message", label: "Message", type: "text" }], { message: "Une automatisation vient de s’exécuter" }, "automatic", undefined, "Notifications", ["notifications"])
    ]
  },
  {
    title: "Contrôle du flow",
    category: "control",
    items: [
      item("stop_flow", "control", "Arrêter le flow", "Met fin à l’automatisation pour ce cas.", "alert", red as never, [], {}, undefined, undefined, "Conditions", ["conditions"]),
      item("limit_once", "control", "Limiter à une exécution", "Empêche ce scénario de traiter deux fois le même événement.", "lock", slate, [], {}, undefined, undefined, "Conditions", ["conditions"])
    ]
  }
];

type TemplateContext = {
  businessName: string;
};

export function createNodeFromLibrary(item: NodeLibraryItem, x = 120, y = 120): AutomationNodeData {
  return {
    id: `${item.type}-${Math.random().toString(36).slice(2, 9)}`,
    type: item.type,
    category: item.category,
    title: item.title,
    description: item.description,
    icon: item.icon,
    color: item.color,
    x,
    y,
    width: 300,
    config: { ...item.defaultConfig },
    mode: item.defaultMode,
    status: "idle"
  };
}

export function buildTemplates(context: TemplateContext): AutomationFlow[] {
  return [
    templateReviews(context.businessName),
    templateWelcome(context.businessName),
    templateInstagram(context.businessName),
    templateLoyalty(context.businessName)
  ];
}

function templateInstagram(businessName: string) {
  const nodes = [
    node("new_reward", "Nouvelle récompense gagnée", 80, 140),
    node("prepare_instagram", "Hans prépare une publication", 400, 140, { theme: "Fidélité client" }, "automatic"),
    node("notify_merchant", "Prévenir le commerçant", 720, 140, { message: `Une publication fidélité est prête pour ${businessName}` }, "automatic"),
    node("publish_instagram", "Publication Instagram", 1040, 140, {}, "semi_automatic")
  ];
  return flow("template-instagram", "Valoriser une récompense client sur Instagram", "Instagram", "Quand une récompense est gagnée, Hans prépare une publication et vous laisse la valider.", nodes, chain(nodes), "template");
}

function templateReviews(businessName: string) {
  const first = node("google_review", "Veille des avis Google", 80, 240, { interval_count: 1, interval_unit: "jour(s)" });
  const condition = node("review_rating_gte", "Vérifier la note", 400, 240, { rating: 4 });
  const positive = node("generate_review_reply", "Hans génère une réponse", 740, 120, { tone: "Chaleureux" }, "automatic");
  const publishPositive = node("publish_review_reply", "Publication automatique", 1060, 120, {}, "automatic");
  const negativeDraft = node("generate_review_reply", "Hans prépare une réponse", 740, 360, { tone: "Professionnel" }, "semi_automatic");
  const notify = node("notify_merchant", "Validation manuelle", 1060, 360, { message: `${businessName} : validation d’un avis sensible` }, "draft_only");
  const publishNegative = node("publish_review_reply", "Publication après validation", 1380, 360, {}, "semi_automatic");
  return flow("template-reviews", "Répondre aux avis selon votre rythme", "Google", "Vous choisissez la fréquence de veille. À chaque passage, Hans suit exactement les étapes et validations de ce scénario.", [first, condition, positive, publishPositive, negativeDraft, notify, publishNegative], [
    edge(first, condition),
    edge(condition, positive, "yes", "Oui"),
    edge(positive, publishPositive),
    edge(condition, negativeDraft, "no", "Non"),
    edge(negativeDraft, notify),
    edge(notify, publishNegative)
  ], "template");
}

function templateWelcome(_businessName: string) {
  const first = node("new_customer", "Nouveau client inscrit au RCU", 80, 220);
  const consent = node("marketing_consent", "Vérifier le consentement e-mail", 420, 220);
  const generate = node("generate_email", "Hans prépare le message de bienvenue", 760, 120, { goal: "Souhaiter chaleureusement la bienvenue au nouveau client" }, "automatic");
  const send = node("send_email", "Envoyer l’e-mail de bienvenue", 1080, 120, { subject: "Bienvenue !", goal: "Souhaiter la bienvenue au nouveau client" }, "automatic");
  const stop = node("stop_flow", "Ne rien envoyer sans consentement", 760, 340);
  return flow("template-welcome", "Envoyer un e-mail de bienvenue après inscription RCU", "RCU + E-mail", "Dès la première inscription RCU, Hans envoie un message au client s’il a accepté les e-mails.", [first, consent, generate, send, stop], [
    edge(first, consent),
    edge(consent, generate, "yes", "Oui"),
    edge(generate, send),
    edge(consent, stop, "no", "Non")
  ], "template");
}

function templateLoyalty(_businessName: string) {
  const first = node("new_reward", "Nouvelle récompense gagnée", 80, 160);
  const condition = node("marketing_consent", "Vérifier le consentement e-mail", 420, 160);
  const email = node("generate_email", "Préparer un message de félicitations", 760, 100, { goal: "Féliciter le client pour sa nouvelle récompense" }, "automatic");
  const send = node("send_email", "Envoyer le message", 1080, 100, { subject: "Bravo pour votre récompense !", goal: "Féliciter le client pour sa récompense" }, "automatic");
  const stop = node("stop_flow", "Ne rien envoyer sans consentement", 760, 300);
  return flow("template-loyalty", "Féliciter un client après une récompense", "RCU + E-mail", "Quand une récompense est gagnée, Hans félicite automatiquement le client ayant consenti aux e-mails.", [first, condition, email, send, stop], [
    edge(first, condition),
    edge(condition, email, "yes", "Oui"),
    edge(email, send),
    edge(condition, stop, "no", "Non")
  ], "template");
}

function item(
  type: string,
  category: NodeLibraryItem["category"],
  title: string,
  description: string,
  icon: NodeLibraryItem["icon"],
  color: string,
  fields: NodeLibraryItem["fields"],
  defaultConfig: NodeLibraryItem["defaultConfig"],
  defaultMode?: NodeLibraryItem["defaultMode"],
  branchLabels?: NodeLibraryItem["branchLabels"],
  provider?: NodeLibraryItem["provider"],
  tags?: NodeLibraryItem["tags"]
): NodeLibraryItem {
  return { type, category, title, description, icon, color, fields, defaultConfig, defaultMode, branchLabels, provider, tags };
}

function node(type: string, title: string, x: number, y: number, config: Record<string, string | number | boolean> = {}, mode?: AutomationNodeData["mode"]): AutomationNodeData {
  const found = NODE_LIBRARY.flatMap((group) => group.items).find((item) => item.type === type);
  if (!found) {
    throw new Error(`Unknown node type: ${type}`);
  }
  return {
    ...createNodeFromLibrary(found, x, y),
    title,
    config: { ...found.defaultConfig, ...config },
    mode: mode ?? found.defaultMode
  };
}

function edge(source: AutomationNodeData, target: AutomationNodeData, branch: AutomationEdge["branch"] = "default", label?: string): AutomationEdge {
  return { id: `edge-${source.id}-${target.id}-${branch}`, source: source.id, target: target.id, branch, label };
}

function chain(nodes: AutomationNodeData[]) {
  return nodes.slice(0, -1).map((current, index) => edge(current, nodes[index + 1]));
}

function flow(id: string, title: string, channel: string, summary: string, nodes: AutomationNodeData[], edges: AutomationEdge[], source: AutomationFlow["source"]): AutomationFlow {
  return {
    id,
    title,
    description: summary,
    summary,
    channel,
    category: channel,
    installMinutes: channel === "Instagram" ? 4 : channel === "Google" ? 3 : 5,
    difficulty: "Simple",
    illustration: "gradient",
    status: "draft",
    source,
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
    lastSavedLabel: "Brouillon prêt",
    version: 1,
    validationIssues: [],
    executionHistory: []
  };
}
