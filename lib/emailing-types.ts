export const EMAIL_CAMPAIGN_TYPES = [
  "promotion",
  "new_product",
  "event",
  "reactivation",
  "loyalty",
  "birthday",
  "newsletter",
  "other"
] as const;

export type EmailCampaignType = (typeof EMAIL_CAMPAIGN_TYPES)[number];
export type EmailCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";
export type EmailSegmentMode = "all" | "any";

export type EmailSegmentRuleId =
  | "all_customers"
  | "new_customers"
  | "loyal_customers"
  | "inactive_customers"
  | "five_star_review"
  | "negative_review"
  | "minimum_visits"
  | "used_reward"
  | "minimum_rewards"
  | "registered_via_rcu"
  | "visited_this_month"
  | "absent_days"
  | "upcoming_birthday";

export type EmailSegmentRule = {
  id: EmailSegmentRuleId;
  value?: number;
};

export type EmailSubscriberProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  source: "rcu" | "import";
  registeredAt: string;
  lastVisitAt: string | null;
  visits: number;
  rewardsWon: number;
  rewardsUsed: number;
  points: number;
  reviewRating: number | null;
  birthday: string | null;
};

export type EmailCampaignContent = {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  signature: string;
  imageUrl: string;
  showLogo: boolean;
  primaryColor: string;
  backgroundColor: string;
  buttonColor: string;
};

export type EmailCampaignRecipient = {
  id: string;
  token: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type EmailCampaignRecord = {
  id: string;
  merchant_id: string;
  name: string;
  campaign_type: EmailCampaignType;
  brief: string;
  segment_rules: EmailSegmentRule[];
  segment_mode: EmailSegmentMode;
  segment_label: string;
  recipient_count: number;
  recipients: EmailCampaignRecipient[];
  content: EmailCampaignContent;
  status: EmailCampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  sent_count: number;
  open_count: number;
  click_count: number;
  open_rate: number;
  click_rate: number;
  provider_message_ids: string[];
  error_message: string | null;
};

export type EmailingDashboardData = {
  subscribers: EmailSubscriberProfile[];
  campaigns: EmailCampaignRecord[];
  providerReady: boolean;
  providerAddress: string | null;
  providerStatus: "connected" | "disconnected" | "error";
  providerError: string | null;
};

export const EMAIL_CAMPAIGN_TYPE_OPTIONS: Array<{
  id: EmailCampaignType;
  label: string;
  description: string;
  emoji: string;
}> = [
  { id: "promotion", label: "Promotion", description: "Une offre claire qui donne envie d’agir.", emoji: "🏷️" },
  { id: "new_product", label: "Nouveauté", description: "Présenter un produit, un service ou une collection.", emoji: "✨" },
  { id: "event", label: "Événement", description: "Inviter vos clients à une date importante.", emoji: "📅" },
  { id: "reactivation", label: "Réactivation", description: "Faire revenir les clients absents.", emoji: "👋" },
  { id: "loyalty", label: "Fidélisation", description: "Récompenser et remercier les habitués.", emoji: "💜" },
  { id: "birthday", label: "Anniversaire", description: "Préparer une attention personnalisée.", emoji: "🎂" },
  { id: "newsletter", label: "Newsletter", description: "Partager plusieurs nouvelles simplement.", emoji: "📰" },
  { id: "other", label: "Autre", description: "Hans s’adapte à votre demande.", emoji: "💡" }
];

export const DEFAULT_EMAIL_CONTENT: EmailCampaignContent = {
  subject: "Une nouveauté vous attend",
  preheader: "Découvrez ce que nous avons préparé pour vous.",
  heading: "Une belle surprise en boutique",
  body: "Bonjour {{first_name}},\n\nNous avons préparé quelque chose de spécial pour vous. Passez nous voir pour en profiter et partager un bon moment avec notre équipe.",
  ctaLabel: "Découvrir",
  ctaUrl: "",
  signature: "À très vite,\nL’équipe",
  imageUrl: "",
  showLogo: true,
  primaryColor: "#4C1D95",
  backgroundColor: "#F8F5FF",
  buttonColor: "#7C3AED"
};
