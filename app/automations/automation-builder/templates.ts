"use client";

import type { AutomationEdge, AutomationFlow, AutomationNodeData, NodeLibraryItem } from "./types";

const purple = "#6E4DE0";
const green = "#2E9E5B";
const amber = "#D18A1D";
const slate = "#6E6A76";
const red = "#C2492F";

const READY_NODE_LIBRARY: Array<{ title: string; category: string; items: NodeLibraryItem[] }> = [
  {
    title: "Déclencheurs",
    category: "trigger",
    items: [
      item("new_customer", "trigger", "Nouveau client inscrit au RCU", "Se déclenche immédiatement lors de la première inscription d’un client au RCU.", "sparkle", purple, [], { source: "RCU" }, undefined, undefined, "Clients / CRM", ["clients", "crm"]),
      item("new_visit", "trigger", "Nouvelle visite RCU validée", "Se déclenche immédiatement quand une nouvelle visite RCU est enregistrée.", "store", purple, [], {}, undefined, undefined, "Commerce", ["commerce", "clients"]),
      item("new_reward", "trigger", "Nouvelle récompense gagnée", "Quand un client gagne une récompense.", "party", purple, [], {}, undefined, undefined, "Clients / CRM", ["crm", "clients"]),
      item("customer_returned", "trigger", "Client revenu après X jours", "Se déclenche lors d'une visite validée après la période d'absence choisie.", "refresh", purple, [{ key: "days", label: "Jours d'absence minimum", type: "number" }], { days: 30 }, undefined, undefined, "Clients / CRM", ["crm", "clients", "visites"]),
      item("customer_inactive", "trigger", "Client absent depuis X jours", "La veille quotidienne détecte un client qui n'est pas revenu depuis la durée choisie.", "refresh", purple, [{ key: "days", label: "Jours d'absence", type: "number" }], { days: 30 }, undefined, undefined, "Clients / CRM", ["crm", "clients", "inactivité"]),
      item("customer_birthday", "trigger", "Anniversaire du client", "La veille quotidienne utilise la date de naissance obligatoire du RCU.", "party", purple, [], {}, undefined, undefined, "Clients / CRM", ["crm", "clients", "anniversaire"]),
      item("registration_anniversary", "trigger", "Anniversaire de l'inscription", "Se déclenche chaque année à la date d'inscription RCU du client.", "party", purple, [], {}, undefined, undefined, "Clients / CRM", ["crm", "clients", "anniversaire"]),
      item("visit_milestone", "trigger", "Client atteint X visites", "Se déclenche exactement lorsque le client atteint le palier de visites.", "store", purple, [{ key: "visits", label: "Palier de visites", type: "number" }], { visits: 5 }, undefined, undefined, "Clients / CRM", ["crm", "clients", "visites"]),
      item("points_milestone", "trigger", "Client atteint X points", "Se déclenche lorsque le solde franchit le palier de points choisi.", "star", purple, [{ key: "points", label: "Palier de points", type: "number" }], { points: 100 }, undefined, undefined, "Clients / CRM", ["crm", "fidélité", "points"]),
      item("profile_completed", "trigger", "Profil RCU complété", "Se déclenche à la première inscription lorsque les coordonnées obligatoires sont complètes.", "check", purple, [], {}, undefined, undefined, "Clients / CRM", ["crm", "clients"]),
      item("consent_granted", "trigger", "Consentements marketing obtenus", "Se déclenche à l'inscription lorsque les consentements e-mail et SMS sont valides.", "lock", purple, [], {}, undefined, undefined, "Clients / CRM", ["crm", "consentement"]),
      item("game_participation", "trigger", "Participation à un jeu RCU", "Se déclenche lors d'une participation validée à une roue ou une tombola.", "party", purple, [], {}, undefined, undefined, "Clients / CRM", ["crm", "jeu", "fidélité"]),
      item("game_reward_won", "trigger", "Gain obtenu via un jeu RCU", "Se déclenche lorsqu'une roue ou une tombola attribue réellement un gain.", "party", purple, [], {}, undefined, undefined, "Clients / CRM", ["crm", "jeu", "récompense"]),
      item("reward_used", "trigger", "Récompense utilisée", "Se déclenche quand le commerçant marque réellement une récompense comme utilisée.", "party", purple, [], {}, undefined, undefined, "Clients / CRM", ["crm", "récompense", "fidélité"]),
      item("near_reward", "trigger", "Client proche d'une récompense", "Se déclenche après une visite lorsqu'il manque au maximum X points.", "star", purple, [{ key: "points", label: "Points manquants maximum", type: "number" }], { points: 25 }, undefined, undefined, "Clients / CRM", ["crm", "récompense", "points"]),
      item("visit_velocity", "trigger", "X visites effectuées en X jours", "Se déclenche lorsque le client atteint la fréquence choisie sur la période.", "chart", purple, [{ key: "visits", label: "Nombre de visites", type: "number" }, { key: "days", label: "Période en jours", type: "number" }], { visits: 3, days: 30 }, undefined, undefined, "Clients / CRM", ["crm", "visites", "fréquence"]),
      item("review_by_rating", "trigger", "Nouvel avis avec une note précise", "Lance le scénario uniquement pour la note configurée.", "star", purple, [{ key: "rating", label: "Note exacte", type: "number" }], { rating: 5 }, undefined, undefined, "Google", ["google", "avis"]),
      item("review_keyword", "trigger", "Mot-clé détecté dans un avis", "Lance le scénario lorsqu'un nouvel avis contient le mot ou l'expression choisie.", "search", purple, [{ key: "keyword", label: "Mot ou expression", type: "text" }], { keyword: "" }, undefined, undefined, "Google", ["google", "avis"]),
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
      item("reward_count", "condition", "Client a gagné au moins X récompenses", "Vérifie le nombre réel de récompenses du client dans le RCU.", "party", green, [{ key: "count", label: "Nombre minimum", type: "number" }], { count: 2 }, undefined, ["yes", "no"], "Clients / CRM", ["conditions", "crm"]),
      item("visit_comparison", "condition", "Client a effectué au moins X visites", "Compte les visites réellement validées dans le RCU.", "chart", green, [{ key: "visits", label: "Nombre minimum de visites", type: "number" }], { visits: 5 }, undefined, ["yes", "no"], "Clients / CRM", ["conditions", "crm", "visites"]),
      item("last_visit_age", "condition", "Visite précédente il y a plus de X jours", "Compare le passage actuel avec la visite RCU précédente du client.", "refresh", green, [{ key: "days", label: "Nombre minimum de jours", type: "number" }], { days: 30 }, undefined, ["yes", "no"], "Clients / CRM", ["conditions", "crm", "visites", "inactivité"]),
      item("points_comparison", "condition", "Client possède au moins X points", "Vérifie le solde réel de points fidélité calculé par le RCU.", "star", green, [{ key: "points", label: "Nombre minimum de points", type: "number" }], { points: 100 }, undefined, ["yes", "no"], "Clients / CRM", ["conditions", "crm", "fidélité", "points"]),
      item("customer_status", "condition", "Statut du client", "Classe le client selon son nombre de visites et son ancienneté réelle.", "store", green, [{ key: "status", label: "Statut recherché", type: "select", options: ["Nouveau", "Régulier", "Fidèle", "Inactif"] }], { status: "Fidèle" }, undefined, ["yes", "no"], "Clients / CRM", ["conditions", "crm"]),
      item("customer_contact_field", "condition", "Coordonnée client disponible", "Vérifie la présence d'un e-mail ou d'un téléphone exploitable.", "phone", green, [{ key: "field", label: "Coordonnée", type: "select", options: ["E-mail", "Téléphone"] }], { field: "E-mail" }, undefined, ["yes", "no"], "Clients / CRM", ["conditions", "crm"]),
      item("review_rating_compare", "condition", "Comparer la note de l'avis", "Teste la note avec l'opérateur choisi.", "star", green, [{ key: "operator", label: "Comparaison", type: "select", options: ["Au moins", "Au plus", "Égale à"] }, { key: "rating", label: "Note", type: "number" }], { operator: "Au moins", rating: 4 }, undefined, ["yes", "no"], "Google", ["conditions", "google", "avis"]),
      item("review_content", "condition", "L'avis contient un mot ou une expression", "Recherche un terme dans le texte réel de l'avis.", "search", green, [{ key: "keyword", label: "Mot ou expression", type: "text" }], { keyword: "" }, undefined, ["yes", "no"], "Google", ["conditions", "google", "avis"]),
      item("review_status", "condition", "État de l'avis", "Détecte un avis positif, négatif ou sensible.", "message", green, [{ key: "status", label: "État recherché", type: "select", options: ["Positif", "Négatif", "Sensible"] }], { status: "Sensible" }, undefined, ["yes", "no"], "Google", ["conditions", "google", "avis"])
    ]
  },
  {
    title: "Actions",
    category: "action",
    items: [
      item("send_email", "action", "Envoyer un e-mail au client", "Génère si nécessaire puis envoie un e-mail au client qui a déclenché le flow.", "mail", amber, [{ key: "subject", label: "Objet", type: "text" }, { key: "goal", label: "Message à transmettre", type: "text" }], { subject: "Bienvenue !", goal: "Souhaiter la bienvenue au nouveau client" }, "automatic", undefined, "E-mails", ["emails"]),
      item("generate_email", "action", "Préparer un e-mail avec Hans", "Hans crée un e-mail personnalisé pour le client du flow.", "sparkle", amber, [{ key: "goal", label: "Objectif", type: "text" }], { goal: "Souhaiter la bienvenue au client" }, "automatic", undefined, "Hans / IA", ["ia", "emails"]),
      item("prepare_instagram", "action", "Préparer une publication Instagram", "Hans rédige le texte et prépare le visuel.", "sparkle", amber, [{ key: "theme", label: "Thème", type: "text" }], { theme: "Nouveautés" }, "semi_automatic", undefined, "Instagram", ["instagram", "ia"]),
      item("publish_instagram", "action", "Publier sur Instagram", "Publie le contenu sur Instagram.", "phone", amber, [], {}, "automatic", undefined, "Instagram", ["instagram"]),
      item("generate_review_reply", "action", "Générer une réponse à un avis", "Hans prépare une réponse adaptée à l’avis.", "sparkle", amber, [{ key: "tone", label: "Ton", type: "select", options: ["Chaleureux", "Professionnel", "Premium"] }], { tone: "Chaleureux" }, "semi_automatic", undefined, "Google", ["google", "avis", "ia"]),
      item("publish_review_reply", "action", "Publier une réponse à un avis", "Publie la réponse sur Google.", "message", amber, [], {}, "automatic", undefined, "Google", ["google", "avis"]),
      item("notify_merchant", "action", "Notifier le commerçant", "Crée une notification réelle dans AtriumOne.", "bell", amber, [{ key: "message", label: "Message", type: "text" }], { message: "Une automatisation vient de s’exécuter" }, "automatic", undefined, "Notifications", ["notifications"]),
      item("request_human_validation", "action", "Demander une validation humaine", "Notifie le commerçant et place la suite du scénario en attente.", "lock", amber, [{ key: "message", label: "Message de validation", type: "text" }], { message: "Une action attend votre validation." }, "semi_automatic", undefined, "Hans / IA", ["validation", "notifications"]),
      item("schedule_instagram", "action", "Planifier une publication Instagram", "Programme le post préparé après le délai choisi.", "phone", amber, [{ key: "delay_hours", label: "Publier dans X heures", type: "number" }], { delay_hours: 24 }, "automatic", undefined, "Instagram", ["instagram", "planification"])
    ]
  },
  {
    title: "Contrôle du flow",
    category: "control",
    items: [
      item("stop_flow", "control", "Arrêter le flow", "Met fin à l’automatisation pour ce cas.", "alert", red as never, [], {}, undefined, undefined, "Contrôle du flow", ["conditions"]),
      item("limit_once", "control", "Limiter à une exécution", "Empêche ce scénario de traiter deux fois le même événement.", "lock", slate, [], {}, undefined, undefined, "Contrôle du flow", ["conditions"]),
      item("cooldown", "control", "Ne pas relancer pendant X jours", "Ignore les nouveaux événements du même client pendant la période choisie.", "refresh", slate, [{ key: "days", label: "Période de repos en jours", type: "number" }], { days: 7 }, undefined, undefined, "Contrôle du flow", ["conditions", "fréquence"]),
      item("allowed_window", "control", "Plage horaire autorisée", "Poursuit uniquement entre les heures choisies, heure de Paris.", "lock", slate, [{ key: "start_hour", label: "Heure de début", type: "number" }, { key: "end_hour", label: "Heure de fin", type: "number" }], { start_hour: 8, end_hour: 20 }, undefined, undefined, "Contrôle du flow", ["conditions", "horaires"])
    ]
  }
];

type PlannedDefinition = {
  type: string;
  category: NodeLibraryItem["category"];
  title: string;
  description: string;
  provider: string;
  icon?: NodeLibraryItem["icon"];
  fields?: NodeLibraryItem["fields"];
  config?: NodeLibraryItem["defaultConfig"];
  branches?: NodeLibraryItem["branchLabels"];
};

const PLANNED_DEFINITIONS: PlannedDefinition[] = [
  { type: "consent_removed", category: "trigger", title: "Consentement marketing retiré", description: "Réagit au retrait d’un consentement marketing.", provider: "Clients / CRM", icon: "lock" },
  { type: "segment_added", category: "trigger", title: "Client ajouté à un segment", description: "Se déclenche lors de l’entrée dans un segment.", provider: "Clients / CRM", icon: "inbox" },
  { type: "segment_removed", category: "trigger", title: "Client retiré d’un segment", description: "Se déclenche lors de la sortie d’un segment.", provider: "Clients / CRM", icon: "inbox" },
  { type: "reward_expiring", category: "trigger", title: "Récompense bientôt expirée", description: "Anticipe l’expiration prochaine d’une récompense.", provider: "Clients / CRM", icon: "alert" },
  { type: "review_unanswered", category: "trigger", title: "Avis sans réponse depuis X heures ou jours", description: "Détecte un avis resté sans réponse trop longtemps.", provider: "Google", icon: "message" },
  { type: "review_modified", category: "trigger", title: "Avis existant modifié", description: "Réagit lorsqu’un client modifie son avis.", provider: "Google", icon: "refresh" },
  { type: "review_signal", category: "trigger", title: "Signal d’avis détecté par Hans", description: "Détecte un avis très positif, sensible ou une nouvelle tendance.", provider: "Hans / IA", icon: "sparkle" },
  { type: "rating_average_below", category: "trigger", title: "Note Google moyenne sous X", description: "Se déclenche quand la moyenne passe sous le seuil choisi.", provider: "Google", icon: "chart" },
  { type: "review_volume", category: "trigger", title: "X nouveaux avis reçus", description: "Se déclenche lorsqu’un volume d’avis est atteint.", provider: "Google", icon: "inbox" },
  { type: "email_event", category: "trigger", title: "Événement e-mail", description: "Détecte un envoi, une ouverture, un clic, une erreur ou une désinscription.", provider: "E-mails", icon: "mail" },
  { type: "email_not_opened", category: "trigger", title: "E-mail non ouvert après X jours", description: "Détecte une absence d’ouverture après le délai choisi.", provider: "E-mails", icon: "mail" },
  { type: "instagram_event", category: "trigger", title: "Événement Instagram", description: "Détecte une publication publiée, planifiée ou non validée.", provider: "Instagram", icon: "phone" },
  { type: "instagram_inactive", category: "trigger", title: "Aucune publication depuis X jours", description: "Détecte une période d’inactivité éditoriale.", provider: "Instagram", icon: "alert" },
  { type: "schedule", category: "trigger", title: "Planification récurrente", description: "Lance un flow chaque jour, semaine ou mois à l’heure choisie.", provider: "Calendrier / Temps", icon: "refresh" },
  { type: "specific_date", category: "trigger", title: "À une date précise", description: "Lance le flow à une date et une heure données.", provider: "Calendrier / Temps", icon: "party" },
  { type: "relative_date", category: "trigger", title: "Avant ou après un événement", description: "Lance le flow X minutes, heures ou jours avant ou après un événement.", provider: "Calendrier / Temps", icon: "refresh" },

  { type: "customer_segment", category: "condition", title: "Client appartient au segment X", description: "Vérifie l’appartenance à un segment RCU.", provider: "Clients / CRM", icon: "inbox", branches: ["yes", "no"] },
  { type: "campaign_already_received", category: "condition", title: "Campagne déjà reçue", description: "Évite de renvoyer une campagne au même client.", provider: "E-mails", icon: "mail", branches: ["yes", "no"] },
  { type: "reward_state", category: "condition", title: "État de la récompense", description: "Vérifie si une récompense est disponible ou utilisée.", provider: "Clients / CRM", icon: "party", branches: ["yes", "no"] },
  { type: "hans_analysis", category: "condition", title: "Analyse de Hans", description: "Teste risque, urgence, opportunité, récurrence ou besoin humain.", provider: "Hans / IA", icon: "sparkle", branches: ["yes", "no"] },
  { type: "hans_confidence", category: "condition", title: "Confiance de Hans supérieure à X %", description: "Autorise une branche selon le niveau de confiance IA.", provider: "Hans / IA", icon: "chart", branches: ["yes", "no"] },

  { type: "hans_decide", category: "action", title: "Laisser Hans décider", description: "Hans choisit l’action la plus sûre parmi celles que vous autorisez.", provider: "Hans / IA", icon: "sparkle" },
  { type: "hans_text_action", category: "action", title: "Créer ou transformer un texte avec Hans", description: "Génère, résume, réécrit ou personnalise un contenu.", provider: "Hans / IA", icon: "sparkle" },
  { type: "hans_strategy_action", category: "action", title: "Créer une recommandation avec Hans", description: "Crée une offre, une campagne, une idée fidélité ou choisit l’action suivante.", provider: "Hans / IA", icon: "sparkle" },
  { type: "add_review_insights", category: "action", title: "Ajouter l’avis aux Insights", description: "Injecte l’avis dans l’analyse de tendances.", provider: "Google", icon: "chart" },
  { type: "generate_instagram_idea", category: "action", title: "Générer une idée Instagram", description: "Hans trouve un angle éditorial à partir du contexte.", provider: "Instagram", icon: "sparkle" },
  { type: "generate_instagram_caption", category: "action", title: "Générer la légende Instagram", description: "Crée une légende prête à publier.", provider: "Instagram", icon: "message" },
  { type: "generate_instagram_visual", category: "action", title: "Générer le visuel Instagram", description: "Crée un visuel conforme à la charte sociale.", provider: "Instagram", icon: "image" },
  { type: "crm_update", category: "action", title: "Mettre à jour le client", description: "Ajoute ou retire tag, segment, statut, note ou information.", provider: "Clients / CRM", icon: "store" },
  { type: "crm_loyalty", category: "action", title: "Modifier la fidélité", description: "Ajoute ou retire des points, attribue ou crée une récompense.", provider: "Clients / CRM", icon: "party" },
  { type: "send_email_template", category: "action", title: "Envoyer un modèle ou une offre", description: "Envoie un modèle, une offre, une récompense ou une relance consentie.", provider: "E-mails", icon: "mail" },
  { type: "generate_email_parts", category: "action", title: "Générer l’objet ou le CTA", description: "Hans prépare automatiquement les éléments clés de l’e-mail.", provider: "E-mails", icon: "sparkle" },

  { type: "wait_delay", category: "delay", title: "Attendre une durée", description: "Attend X minutes, heures ou jours avant de poursuivre.", provider: "Calendrier / Temps", icon: "refresh" },
  { type: "wait_until", category: "delay", title: "Attendre une date, une heure ou une condition", description: "Met le flow en attente jusqu’au moment ou signal choisi.", provider: "Calendrier / Temps", icon: "refresh" },
  { type: "multi_branch", category: "control", title: "Plusieurs branches", description: "Oriente le flow selon une valeur ou une décision de Hans.", provider: "Contrôle du flow", icon: "link", branches: ["yes", "no"] },
  { type: "execution_limit", category: "control", title: "Limiter les exécutions", description: "Définit un maximum par client, jour ou période.", provider: "Contrôle du flow", icon: "lock" },
  { type: "stop_guard", category: "control", title: "Arrêt conditionnel", description: "Arrête si désinscription, retour client ou récompense utilisée.", provider: "Contrôle du flow", icon: "alert" },
];

const PLANNED_NODE_GROUPS = [
  { title: "Capacités avancées", category: "planned", items: PLANNED_DEFINITIONS.map(plannedItem) }
];

export const NODE_LIBRARY: Array<{ title: string; category: string; items: NodeLibraryItem[] }> = [...READY_NODE_LIBRARY, ...PLANNED_NODE_GROUPS];

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
    status: item.availability === "planned" ? "warning" : "idle"
  };
}

export function buildTemplates(context: TemplateContext): AutomationFlow[] {
  return [
    templateReviews(context.businessName),
    templateWelcome(context.businessName),
    templateInstagram(context.businessName),
    templateLoyalty(context.businessName),
    templateReputationGuardian(context.businessName),
    templateNewCustomerHabit(context.businessName),
    templateDormantCustomers(context.businessName),
    templateBestCustomers(context.businessName),
    templateInstagramPilot(context.businessName),
    templateRewardReturn(context.businessName)
  ];
}

function templateReputationGuardian(businessName: string) {
  const recipe = templateReviews(businessName);
  recipe.id = "recipe-reputation-guardian";
  recipe.title = "Gardien de réputation";
  recipe.summary = "Hans répond aux avis positifs et protège les cas sensibles par une validation humaine.";
  recipe.description = recipe.summary;
  recipe.category = "Recettes Hans";
  return recipe;
}

function templateNewCustomerHabit(_businessName: string) {
  const first = node("new_customer", "Nouveau client inscrit", 80, 180);
  const consent = node("marketing_consent", "Consentement e-mail valide", 400, 180);
  const welcome = node("generate_email", "Hans prépare le message de bienvenue", 720, 80, { goal: "Souhaiter la bienvenue et donner envie de revenir" }, "automatic");
  const send = node("send_email", "Envoyer l’e-mail de bienvenue", 1040, 80, { subject: "Bienvenue chez nous", goal: "Présenter le programme fidélité" }, "automatic");
  const wait = node("wait_delay", "Attendre 7 jours", 1360, 80, { days: 7 });
  const returned = node("last_visit_age", "Le client est-il revenu ?", 1680, 80, { days: 7 });
  const reminder = node("generate_email", "Préparer une relance douce", 2000, 220, { goal: "Inviter le client à revenir sans promotion inventée" }, "semi_automatic");
  const stop = node("stop_flow", "Ne rien envoyer sans consentement", 720, 320);
  return flow("recipe-new-customer-habit", "Transformer un nouveau client en habitué", "RCU + E-mail", "Bienvenue immédiate, attente puis relance uniquement si le client n’est pas revenu.", [first, consent, welcome, send, wait, returned, reminder, stop], [
    edge(first, consent), edge(consent, welcome, "yes", "Oui"), edge(welcome, send), edge(send, wait), edge(wait, returned), edge(returned, stop, "yes", "Revenu"), edge(returned, reminder, "no", "Pas revenu"), edge(consent, stop, "no", "Non")
  ], "template");
}

function templateDormantCustomers(_businessName: string) {
  const first = node("customer_inactive", "Client absent depuis 45 jours", 80, 180, { days: 45 });
  const consent = node("marketing_consent", "Consentement e-mail valide", 400, 180);
  const generate = node("generate_email", "Hans personnalise la campagne", 720, 80, { goal: "Donner une raison concrète de revenir" }, "automatic");
  const send = node("send_email", "Envoyer la relance", 1040, 80, { subject: "Cela fait longtemps", goal: "Réactiver le client" }, "automatic");
  const stop = node("stop_flow", "Ne rien envoyer", 720, 320);
  return flow("recipe-dormant-customers", "Réveiller mes clients dormants", "RCU + E-mail", "Détecte les clients absents et prépare une relance consentie et personnalisée.", [first, consent, generate, send, stop], [edge(first, consent), edge(consent, generate, "yes", "Oui"), edge(generate, send), edge(consent, stop, "no", "Non")], "template");
}

function templateBestCustomers(_businessName: string) {
  const first = node("visit_milestone", "Client atteint 10 visites", 80, 140, { visits: 10 });
  const vip = node("crm_update", "Marquer le client comme VIP", 400, 140, { status: "VIP" }, "automatic");
  const reward = node("crm_loyalty", "Attribuer une récompense", 720, 140, { reward: "Récompense VIP" }, "automatic");
  const message = node("generate_email", "Hans personnalise le message", 1040, 140, { goal: "Remercier le client pour sa fidélité" }, "automatic");
  return flow("recipe-best-customers", "Récompenser mes meilleurs clients", "Clients / CRM", "Identifie un palier de fidélité, marque le client VIP et prépare sa récompense.", [first, vip, reward, message], chain([first, vip, reward, message]), "template");
}

function templateInstagramPilot(_businessName: string) {
  const first = node("google_review", "Analyser les nouveaux avis", 80, 140, { interval_count: 1, interval_unit: "jour(s)" });
  const idea = node("generate_instagram_idea", "Hans détecte un sujet intéressant", 400, 140, {}, "automatic");
  const prepare = node("prepare_instagram", "Créer le texte et le visuel", 720, 140, { theme: "Sujet détecté dans les avis" }, "automatic");
  const approval = node("notify_merchant", "Demander la validation", 1040, 140, { message: "Une publication issue des avis est prête." }, "automatic");
  const schedule = node("schedule_instagram", "Planifier après validation", 1360, 140, {}, "semi_automatic");
  return flow("recipe-instagram-pilot", "Instagram en pilote automatique", "Instagram + Google", "Transforme les sujets intéressants des avis en publications prêtes à valider.", [first, idea, prepare, approval, schedule], chain([first, idea, prepare, approval, schedule]), "template");
}

function templateRewardReturn(_businessName: string) {
  const first = node("new_reward", "Nouvelle récompense gagnée", 80, 160);
  const consent = node("marketing_consent", "Consentement e-mail valide", 400, 160);
  const email = node("generate_email", "Préparer le message de récompense", 720, 60, { goal: "Présenter la récompense et inviter à revenir" }, "automatic");
  const send = node("send_email", "Envoyer le message", 1040, 60, { subject: "Votre récompense vous attend", goal: "Inviter à utiliser la récompense" }, "automatic");
  const wait = node("wait_delay", "Attendre 7 jours", 1360, 60, { days: 7 });
  const used = node("reward_state", "Récompense utilisée ?", 1680, 60, { state: "used" });
  const reminder = node("generate_email", "Préparer un rappel", 2000, 220, { goal: "Rappeler que la récompense est disponible" }, "semi_automatic");
  const stop = node("stop_flow", "Arrêter le scénario", 2000, 20);
  return flow("recipe-reward-return", "Transformer une récompense en nouvelle visite", "Fidélité + E-mail", "Informe le client, attend puis rappelle uniquement si la récompense reste inutilisée.", [first, consent, email, send, wait, used, reminder, stop], [
    edge(first, consent), edge(consent, email, "yes", "Oui"), edge(email, send), edge(send, wait), edge(wait, used), edge(used, stop, "yes", "Utilisée"), edge(used, reminder, "no", "Non utilisée"), edge(consent, stop, "no", "Non")
  ], "template");
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

function plannedItem(definition: PlannedDefinition): NodeLibraryItem {
  return {
    ...item(
      definition.type,
      definition.category,
      definition.title,
      definition.description,
      definition.icon ?? "sparkle",
      definition.category === "trigger" ? purple : definition.category === "condition" ? green : definition.category === "action" ? amber : slate,
      definition.fields ?? [],
      definition.config ?? {},
      definition.category === "action" ? "semi_automatic" : undefined,
      definition.branches,
      definition.provider,
      ["à connecter"]
    ),
    availability: "planned",
    availabilityNote: getPlannedBlocker(definition)
  };
}

function getPlannedBlocker(definition: PlannedDefinition) {
  if (definition.category === "delay" || definition.provider === "Calendrier / Temps") return "Moteur différé et file d'attente nécessaires";
  if (definition.provider === "Instagram") return "Événement ou action Meta à raccorder";
  if (definition.provider === "E-mails") return "Événement de suivi e-mail à raccorder";
  if (definition.provider === "Google") return "Lecture agrégée Google à raccorder";
  if (definition.provider === "Hans / IA") return "Sortie IA structurée à raccorder au flow";
  if (definition.provider === "Clients / CRM") return "Événement ou écriture CRM encore absent";
  return "Exécuteur dédié encore absent";
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
