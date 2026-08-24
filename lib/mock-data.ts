import { generatedReplyFor, testReviewsSeed } from "@/lib/test-reviews-seed";

export type ReviewStatus = "urgent" | "a-traiter" | "a_traiter" | "ready_to_publish" | "validation_required" | "repondu" | "generated" | "published" | "published_auto" | "published_manual" | "blocked_by_safety" | "ignored";
export type ReviewSentiment = "positif" | "neutre" | "negatif";
export type GeneratedReplyStatus = "generated" | "selected" | "approved" | "validation_required" | "published" | "published_auto" | "published_manual" | "blocked_by_safety" | "superseded";

export type Review = {
  id: string;
  author: string;
  initials: string;
  avatarColor: "red" | "green" | "amber" | "gray" | "navy";
  rating: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  status: ReviewStatus;
  sentiment: ReviewSentiment;
  text: string;
  generatedReply?: string;
  generatedReplyId?: string;
  generatedReplyStatus?: GeneratedReplyStatus;
  generatedText?: string;
  isReplyEdited?: boolean;
  replyCreatedAt?: string;
  publishedAt?: string;
};

export type Kpi = {
  label: string;
  icon: string;
  value: string;
  unit?: string;
  subtext?: string;
  trend?: string;
  trendTone?: "up" | "down" | "neutral";
  stars?: string;
  valueTone?: "default" | "danger";
  compact?: boolean;
  accent?: "purple" | "red" | "green" | "amber";
};

export const merchant = {
  name: "Maison Lavigne",
  initials: "ML",
  plan: "Plan Essentiel",
  category: "Fleuriste",
  address: "14 rue des Lilas, Lyon 6e",
  icon: "🌹",
  googleConnected: true
};

export const kpis: Kpi[] = [
  {
    label: "Note Google",
    icon: "⭐",
    value: "4,6",
    unit: "/ 5",
    stars: "★★★★½"
  },
  {
    label: "Total des avis",
    icon: "💬",
    value: "328",
    trend: "↑ +12 ce mois",
    trendTone: "up"
  },
  {
    label: "Sans réponse",
    icon: "📭",
    value: "18",
    trend: "⚠ À traiter",
    trendTone: "down",
    valueTone: "danger"
  },
  {
    label: "Délai moyen",
    icon: "⏱️",
    value: "6",
    unit: "h",
    trend: "↑ Meilleur qu'avant",
    trendTone: "up"
  },
  {
    label: "Tendance",
    icon: "📈",
    value: "En hausse",
    trend: "+0,2 pt en 30 jours",
    trendTone: "up",
    compact: true
  },
  {
    label: "Satisfaction",
    icon: "😊",
    value: "91",
    unit: "%",
    trend: "↑ Très satisfaisant",
    trendTone: "up"
  }
];

export const trendData = [
  { month: "Jan", positive: 32, negative: 4 },
  { month: "Fév", positive: 28, negative: 6 },
  { month: "Mar", positive: 41, negative: 3 },
  { month: "Avr", positive: 38, negative: 5 },
  { month: "Mai", positive: 52, negative: 3 },
  { month: "Juin", positive: 44, negative: 2 }
];

function initials(authorName: string) {
  return authorName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function dateLabel(daysAgo: number) {
  if (daysAgo <= 1) {
    return "Hier";
  }

  return `Il y a ${daysAgo} jours`;
}

export const reviews: Review[] = testReviewsSeed.map(([author, rating, text, sentiment, status, daysAgo], index) => {
  const colors: Review["avatarColor"][] = ["red", "green", "amber", "gray", "navy"];
  const generatedReply = generatedReplyFor(author, status);
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `mock-${index + 1}`,
    author,
    initials: initials(author),
    avatarColor: colors[index % colors.length],
    rating,
    date: dateLabel(daysAgo),
    createdAt,
    status,
    sentiment,
    text,
    generatedReply: generatedReply ?? undefined,
    generatedReplyId: generatedReply ? `mock-reply-${index + 1}` : undefined,
    generatedReplyStatus: status === "repondu" ? "published" : status === "ready_to_publish" ? "approved" : generatedReply ? "generated" : undefined,
    generatedText: generatedReply ?? undefined,
    publishedAt: status === "repondu" ? dateLabel(Math.max(1, daysAgo - 1)) : undefined
  };
});

export const recommendations = [
  {
    title: "Répondre immédiatement à Marie Renault",
    text: "Son avis négatif sur le bouquet de mariage est prioritaire. Une réponse empathique dans l'heure peut transformer ce problème en preuve de votre sérieux."
  },
  {
    title: "Mentionner la fraîcheur garantie",
    text: "Hans a détecté que c'est le mot-clé qui ressort le plus dans vos avis 5 étoiles. L'inclure dans vos réponses renforce votre référencement Google."
  },
  {
    title: "Lancer une campagne avis ce vendredi",
    text: "Votre taux de retour client est excellent (91%). Hans peut rédiger un SMS à envoyer à vos 47 clients fidèles de ce mois pour booster vos avis."
  }
];

export const tools = [
  {
    icon: "📱",
    name: "Posts réseaux sociaux",
    description:
      "Hans génère des publications Instagram, Facebook et Google Posts adaptées à votre boutique en quelques secondes.",
    status: "Actif",
    active: true,
    action: "Découvrir",
    tone: "blue"
  },
  {
    icon: "🖼️",
    name: "Générateur d'affiches magasin",
    description:
      "Créez des affiches promotionnelles, menus ou annonces avec votre charte graphique en un clic.",
    status: "Bientôt disponible",
    active: false,
    action: "M'alerter",
    tone: "amber"
  },
  {
    icon: "💬",
    name: "Assistant WhatsApp / SMS",
    description:
      "Répondez à vos messages clients automatiquement. Hans rédige des réponses naturelles à votre place.",
    status: "Bientôt disponible",
    active: false,
    action: "M'alerter",
    tone: "green"
  },
  {
    icon: "🎉",
    name: "Générateur d'événements locaux",
    description:
      "Planifiez et promouvez ateliers, ventes privées et animations de quartier grâce à Hans.",
    status: "Bientôt disponible",
    active: false,
    action: "M'alerter",
    tone: "purple"
  }
];

export const bulkActions = [
  "🔍 Analyse des 18 avis en cours...",
  "✅ Avis de Marie Renault, réponse générée",
  "✅ Avis de Paul Duchêne, réponse générée",
  "✅ Avis de Thomas Coste, réponse générée",
  "✅ Avis de Amélie Leclerc, réponse générée",
  "✅ Avis de Julien Martin, réponse générée",
  "✅ Avis de Claire Fontaine, réponse générée",
  "✅ Avis de Nicolas Garnier, réponse générée",
  "✅ Avis de Isabelle Moreau, réponse générée",
  "✅ Avis de Camille Rousseau, réponse générée",
  "✅ Avis de Antoine Dupont, réponse générée",
  "✅ Avis de Laure Perrin, réponse générée",
  "✅ Avis de Marc Lefebvre, réponse générée",
  "✅ Avis de Emma Blanchard, réponse générée",
  "✅ Avis de Hugo Roux, réponse générée",
  "✅ Avis de Léa Simon, réponse générée",
  "✅ Avis de Théo Bernard, réponse générée",
  "✅ Avis de Chloé Petit, réponse générée",
  "✅ Avis de Maxime Girard, réponse générée"
];
