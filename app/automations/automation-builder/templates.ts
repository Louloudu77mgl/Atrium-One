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
      item("new_customer", "trigger", "Nouveau client inscrit", "Quand un nouveau client rejoint votre base.", "sparkle", purple, [{ key: "source", label: "Source", type: "select", options: ["RCU", "Site web", "Caisse"] }], { source: "RCU" }, undefined, undefined, "CRM", ["clients", "crm"]),
      item("new_visit", "trigger", "Nouvelle visite validée", "Quand une visite est confirmée par le commerçant.", "store", purple, [{ key: "check_time", label: "Vérifier à", type: "text" }], { check_time: "09:00" }, undefined, undefined, "Commerce", ["commerce", "clients"]),
      item("new_reward", "trigger", "Nouvelle récompense gagnée", "Quand un client gagne une récompense.", "party", purple, [], {}, undefined, undefined, "CRM", ["crm", "clients"]),
      item("google_review", "trigger", "Nouvel avis Google", "Quand un nouvel avis est publié.", "star", purple, [], {}, undefined, undefined, "Google", ["google", "avis"]),
      item("inactive_customer", "trigger", "Client inactif depuis X jours", "Vérifie les clients absents depuis un certain temps.", "refresh", purple, [{ key: "days", label: "Nombre de jours", type: "number" }, { key: "check_time", label: "Vérifier à", type: "text" }], { days: 30, check_time: "09:00" }, undefined, undefined, "CRM", ["crm", "clients", "emails"]),
      item("weekly", "trigger", "Nouvelle semaine", "Lance une automatisation chaque semaine.", "document", purple, [{ key: "day", label: "Jour", type: "select", options: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"] }, { key: "time", label: "Heure", type: "text" }], { day: "Lundi", time: "09:00" }, undefined, undefined, "Calendrier", ["calendrier"]),
      item("scheduled_date", "trigger", "Date programmée", "Lance l’automatisation à date fixe.", "document", purple, [{ key: "date", label: "Date", type: "text" }, { key: "time", label: "Heure", type: "text" }], { date: "Chaque mois", time: "10:00" }, undefined, undefined, "Calendrier", ["calendrier"])
    ]
  },
  {
    title: "Conditions",
    category: "condition",
    items: [
      item("segment_match", "condition", "Client appartient à un segment", "Vérifie si le client est dans le bon segment.", "chart", green, [{ key: "segment", label: "Segment", type: "text" }], { segment: "Clients fidèles" }, undefined, ["yes", "no"], "CRM", ["conditions", "crm"]),
      item("marketing_consent", "condition", "Client a accepté les emails marketing", "Évite de contacter les clients sans consentement.", "lock", green, [], {}, undefined, ["yes", "no"], "Emails", ["conditions", "emails"]),
      item("review_rating_gte", "condition", "Note de l’avis supérieure ou égale à X", "Filtre les avis selon leur note.", "star", green, [{ key: "rating", label: "Note minimale", type: "number" }], { rating: 4 }, undefined, ["yes", "no"], "Google", ["conditions", "google", "avis"]),
      item("reward_count", "condition", "Client a gagné au moins X récompenses", "Vérifie le niveau d’engagement du client.", "party", green, [{ key: "count", label: "Nombre minimum", type: "number" }], { count: 2 }, undefined, ["yes", "no"], "CRM", ["conditions", "crm"]),
      item("no_recent_message", "condition", "Aucun message récent envoyé", "Évite de trop solliciter le client.", "message", green, [{ key: "days", label: "Depuis combien de jours", type: "number" }], { days: 7 }, undefined, ["yes", "no"], "Notifications", ["conditions", "notifications"])
    ]
  },
  {
    title: "Actions",
    category: "action",
    items: [
      item("send_email", "action", "Envoyer un email", "Envoie un message à un segment ou à un client.", "mail", amber, [{ key: "subject", label: "Objet", type: "text" }], { subject: "On pense à vous" }, "semi_automatic", undefined, "Emails", ["emails"]),
      item("generate_email", "action", "Générer un email avec Hans", "Hans prépare un email prêt à valider.", "sparkle", amber, [{ key: "goal", label: "Objectif", type: "text" }], { goal: "Réactiver le client" }, "semi_automatic", undefined, "Actions IA", ["ia", "emails"]),
      item("prepare_newsletter", "action", "Préparer une newsletter", "Hans rédige la campagne et la met en prévisualisation.", "document", amber, [{ key: "segment", label: "Segment", type: "text" }], { segment: "Clients inscrits via le RCU" }, "semi_automatic", undefined, "Emails", ["emails"]),
      item("send_newsletter", "action", "Envoyer une newsletter", "Programme ou envoie la newsletter.", "mail", amber, [{ key: "segment", label: "Segment", type: "text" }], { segment: "Clients inscrits via le RCU" }, "semi_automatic", undefined, "Emails", ["emails"]),
      item("prepare_instagram", "action", "Préparer une publication Instagram", "Hans rédige le texte et prépare le visuel.", "sparkle", amber, [{ key: "theme", label: "Thème", type: "text" }], { theme: "Nouveautés" }, "semi_automatic", undefined, "Instagram", ["instagram", "ia"]),
      item("publish_instagram", "action", "Publier sur Instagram", "Publie le contenu sur Instagram.", "phone", amber, [], {}, "automatic", undefined, "Instagram", ["instagram"]),
      item("generate_review_reply", "action", "Générer une réponse à un avis", "Hans prépare une réponse adaptée à l’avis.", "sparkle", amber, [{ key: "tone", label: "Ton", type: "select", options: ["Chaleureux", "Professionnel", "Premium"] }], { tone: "Chaleureux" }, "semi_automatic", undefined, "Google", ["google", "avis", "ia"]),
      item("publish_review_reply", "action", "Publier une réponse à un avis", "Publie la réponse sur Google.", "message", amber, [], {}, "automatic", undefined, "Google", ["google", "avis"]),
      item("notify_merchant", "action", "Envoyer une notification", "Préviens le commerçant pour validation ou action.", "bell", amber, [{ key: "message", label: "Message", type: "text" }], { message: "Une validation est requise" }, "draft_only", undefined, "Notifications", ["notifications"]),
      item("add_segment", "action", "Ajouter à un segment", "Ajoute le client à un segment ciblé.", "chart", amber, [{ key: "segment", label: "Segment", type: "text" }], { segment: "À réactiver" }, "automatic", undefined, "CRM", ["crm"]),
      item("add_points", "action", "Ajouter des points", "Ajoute un bonus fidélité au client.", "party", amber, [{ key: "points", label: "Points", type: "number" }], { points: 20 }, "automatic", undefined, "Commerce", ["commerce", "crm"])
    ]
  },
  {
    title: "Contrôle du flow",
    category: "control",
    items: [
      item("wait_delay", "delay", "Attendre X jours", "Suspend le flow avant l’étape suivante.", "refresh", slate, [{ key: "days", label: "Nombre de jours", type: "number" }], { days: 7 }, undefined, undefined, "Attente", ["attente"]),
      item("stop_flow", "control", "Arrêter le flow", "Met fin à l’automatisation pour ce cas.", "alert", red as never, [], {}, undefined, undefined, "Conditions", ["conditions"]),
      item("limit_once", "control", "Limiter à une exécution par client", "Empêche plusieurs exécutions identiques.", "lock", slate, [], {}, undefined, undefined, "Variables", ["variables"])
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
    templateInstagram(context.businessName),
    templateNewsletter(context.businessName),
    templateReactivation(context.businessName),
    templateLoyalty(context.businessName)
  ];
}

function templateInstagram(businessName: string) {
  const nodes = [
    node("weekly", "Nouvelle semaine", 80, 140, { day: "Lundi", time: "09:00" }),
    node("prepare_instagram", "Hans génère une idée", 380, 140, { theme: "Nouveautés" }, "semi_automatic"),
    node("prepare_instagram", "Hans prépare le texte", 680, 140, { theme: "Promotions" }, "semi_automatic"),
    node("prepare_instagram", "Hans prépare le visuel", 980, 140, { theme: "Coulisses" }, "semi_automatic"),
    node("notify_merchant", "Validation du commerçant", 1280, 140, { message: `Valider les publications Instagram de ${businessName}` }, "draft_only"),
    node("publish_instagram", "Publication Instagram", 1580, 140, {}, "semi_automatic")
  ];
  return flow("template-instagram", "Créer deux publications Instagram par semaine", "Instagram", "Hans prépare deux publications chaque semaine et vous laisse les valider avant diffusion.", nodes, chain(nodes), "template");
}

function templateReviews(businessName: string) {
  const first = node("google_review", "Nouvel avis Google", 80, 240);
  const condition = node("review_rating_gte", "Vérifier la note", 400, 240, { rating: 4 });
  const positive = node("generate_review_reply", "Hans génère une réponse", 740, 120, { tone: "Chaleureux" }, "automatic");
  const publishPositive = node("publish_review_reply", "Publication automatique", 1060, 120, {}, "automatic");
  const negativeDraft = node("generate_review_reply", "Hans prépare une réponse", 740, 360, { tone: "Professionnel" }, "semi_automatic");
  const notify = node("notify_merchant", "Validation manuelle", 1060, 360, { message: `${businessName} : validation d’un avis sensible` }, "draft_only");
  const publishNegative = node("publish_review_reply", "Publication après validation", 1380, 360, {}, "semi_automatic");
  return flow("template-reviews", "Répondre automatiquement aux avis", "Google", "Hans répond automatiquement aux avis positifs et vous laisse valider les réponses sensibles.", [first, condition, positive, publishPositive, negativeDraft, notify, publishNegative], [
    edge(first, condition),
    edge(condition, positive, "yes", "Oui"),
    edge(positive, publishPositive),
    edge(condition, negativeDraft, "no", "Non"),
    edge(negativeDraft, notify),
    edge(notify, publishNegative)
  ], "template");
}

function templateNewsletter(_businessName: string) {
  const nodes = [
    node("scheduled_date", "Déclencheur mensuel", 80, 140, { date: "Chaque mois", time: "10:00" }),
    node("segment_match", "Sélectionner un segment", 380, 140, { segment: "Clients inscrits via le RCU" }),
    node("generate_email", "Hans génère le sujet", 700, 140, { goal: "Donner envie d’ouvrir la newsletter" }, "semi_automatic"),
    node("prepare_newsletter", "Hans rédige l’email", 1020, 140, { segment: "Clients inscrits via le RCU" }, "semi_automatic"),
    node("notify_merchant", "Prévisualisation", 1340, 140, { message: "Prévisualiser et valider la newsletter" }, "draft_only"),
    node("send_newsletter", "Envoi de la newsletter", 1660, 140, { segment: "Clients inscrits via le RCU" }, "semi_automatic")
  ];
  return flow("template-newsletter", "Envoyer une newsletter mensuelle", "E-mail", "Chaque mois, Hans prépare une newsletter ciblée puis vous demande une validation avant envoi.", nodes, chain(nodes), "template");
}

function templateReactivation(_businessName: string) {
  const first = node("inactive_customer", "Vérification quotidienne", 80, 220, { days: 30, check_time: "09:00" });
  const consent = node("marketing_consent", "Vérifier le consentement email", 420, 220);
  const generate = node("generate_email", "Hans génère un message personnalisé", 760, 120, { goal: "Réactiver le client absent" }, "semi_automatic");
  const send = node("send_email", "Envoyer l’email", 1080, 120, { subject: "On serait ravis de vous revoir" }, "semi_automatic");
  const wait = node("wait_delay", "Attendre 7 jours", 1400, 120, { days: 7 });
  const segment = node("add_segment", "Ajouter au segment À réactiver", 1720, 120, { segment: "À réactiver" }, "automatic");
  const stop = node("stop_flow", "Arrêter si pas de consentement", 760, 340);
  return flow("template-reactivation", "Relancer les clients absents depuis 30 jours", "E-mail", "Hans relance les clients absents, puis les place dans un segment dédié si besoin.", [first, consent, generate, send, wait, segment, stop], [
    edge(first, consent),
    edge(consent, generate, "yes", "Oui"),
    edge(generate, send),
    edge(send, wait),
    edge(wait, segment),
    edge(consent, stop, "no", "Non")
  ], "template");
}

function templateLoyalty(_businessName: string) {
  const first = node("new_reward", "Nouvelle récompense gagnée", 80, 160);
  const condition = node("reward_count", "Vérifier le nombre total de récompenses", 420, 160, { count: 2 });
  const addSegment = node("add_segment", "Ajouter au segment Clients très engagés", 760, 100, { segment: "Clients très engagés" }, "automatic");
  const email = node("generate_email", "Envoyer un email personnalisé", 1080, 100, { goal: "Remercier et récompenser" }, "semi_automatic");
  const points = node("add_points", "Ajouter un bonus de fidélité", 1400, 100, { points: 20 }, "automatic");
  const stop = node("stop_flow", "Arrêter si le client n’a pas encore 2 récompenses", 760, 300);
  return flow("template-loyalty", "Récompenser les clients ayant gagné deux fois", "RCU + E-mail", "Quand un client devient très engagé, Hans le valorise avec un bonus et un message dédié.", [first, condition, addSegment, email, points, stop], [
    edge(first, condition),
    edge(condition, addSegment, "yes", "Oui"),
    edge(addSegment, email),
    edge(email, points),
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
