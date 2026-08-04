import type { EmailSegmentMode, EmailSegmentRule, EmailSegmentRuleId, EmailSubscriberProfile } from "@/lib/emailing-types";

export type EmailSegmentDefinition = {
  id: EmailSegmentRuleId;
  label: string;
  description: string;
  defaultValue?: number;
  valueLabel?: string;
};

export const EMAIL_SEGMENT_DEFINITIONS: EmailSegmentDefinition[] = [
  { id: "all_customers", label: "Tous les clients", description: "Tous les abonnés e-mail consentis." },
  { id: "new_customers", label: "Nouveaux clients", description: "Inscrits au cours des 30 derniers jours." },
  { id: "loyal_customers", label: "Clients fidèles", description: "Au moins 5 visites validées." },
  { id: "inactive_customers", label: "Clients inactifs", description: "Aucune visite depuis 30 jours." },
  { id: "five_star_review", label: "Avis 5 étoiles", description: "Clients identifiés avec un avis 5 étoiles." },
  { id: "negative_review", label: "Avis négatif", description: "Clients identifiés avec un avis de 1 ou 2 étoiles." },
  { id: "minimum_visits", label: "Plus de X visites", description: "Choisissez le nombre minimum de visites.", defaultValue: 3, valueLabel: "visites" },
  { id: "used_reward", label: "Récompense utilisée", description: "A déjà utilisé au moins une récompense." },
  { id: "minimum_rewards", label: "Au moins X récompenses", description: "A gagné plusieurs récompenses RCU.", defaultValue: 2, valueLabel: "récompenses" },
  { id: "registered_via_rcu", label: "Inscrits via le RCU", description: "Contacts collectés depuis une expérience RCU." },
  { id: "visited_this_month", label: "Venus ce mois-ci", description: "Au moins une visite pendant le mois en cours." },
  { id: "absent_days", label: "Absents depuis X jours", description: "Choisissez la durée d’absence.", defaultValue: 30, valueLabel: "jours" },
  { id: "upcoming_birthday", label: "Anniversaire prochainement", description: "Anniversaire dans les 30 prochains jours." }
];

function differenceInDays(date: Date, reference: Date) {
  return Math.floor((reference.getTime() - date.getTime()) / 86_400_000);
}

function isBirthdayUpcoming(birthday: string | null, now: Date) {
  if (!birthday) return false;
  const parsed = new Date(birthday);
  if (Number.isNaN(parsed.getTime())) return false;
  const next = new Date(now.getFullYear(), parsed.getMonth(), parsed.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  return differenceInDays(now, next) <= 30;
}

export function matchesEmailSegmentRule(profile: EmailSubscriberProfile, rule: EmailSegmentRule, now = new Date()) {
  const registeredAt = new Date(profile.registeredAt);
  const lastVisitAt = profile.lastVisitAt ? new Date(profile.lastVisitAt) : null;
  const absentDays = lastVisitAt ? differenceInDays(lastVisitAt, now) : Number.POSITIVE_INFINITY;

  switch (rule.id) {
    case "all_customers": return true;
    case "new_customers": return differenceInDays(registeredAt, now) <= 30;
    case "loyal_customers": return profile.visits >= 5;
    case "inactive_customers": return absentDays >= 30;
    case "five_star_review": return profile.reviewRating === 5;
    case "negative_review": return profile.reviewRating !== null && profile.reviewRating <= 2;
    case "minimum_visits": return profile.visits >= Math.max(1, rule.value ?? 3);
    case "used_reward": return profile.rewardsUsed > 0;
    case "minimum_rewards": return profile.rewardsWon >= Math.max(1, rule.value ?? 2);
    case "registered_via_rcu": return profile.source === "rcu";
    case "visited_this_month": return Boolean(lastVisitAt && lastVisitAt.getMonth() === now.getMonth() && lastVisitAt.getFullYear() === now.getFullYear());
    case "absent_days": return absentDays >= Math.max(1, rule.value ?? 30);
    case "upcoming_birthday": return isBirthdayUpcoming(profile.birthday, now);
  }
}

export function filterEmailSubscribers(
  subscribers: EmailSubscriberProfile[],
  rules: EmailSegmentRule[],
  mode: EmailSegmentMode
) {
  if (rules.length === 0) return [];
  return subscribers.filter((profile) => mode === "all"
    ? rules.every((rule) => matchesEmailSegmentRule(profile, rule))
    : rules.some((rule) => matchesEmailSegmentRule(profile, rule)));
}

export function getEmailSegmentLabel(rules: EmailSegmentRule[], mode: EmailSegmentMode) {
  if (rules.length === 0) return "Aucun segment";
  return rules.map((rule) => {
    const definition = EMAIL_SEGMENT_DEFINITIONS.find((item) => item.id === rule.id);
    if (!definition) return rule.id;
    return definition.valueLabel ? `${definition.label.replace("X", String(rule.value ?? definition.defaultValue ?? ""))}` : definition.label;
  }).join(mode === "all" ? " ET " : " OU ");
}
