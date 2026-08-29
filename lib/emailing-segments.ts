import type { EmailSegmentMode, EmailSegmentRule, EmailSegmentRuleId, EmailSubscriberProfile } from "@/lib/emailing-types";

export type EmailSegmentDefinition = {
  id: EmailSegmentRuleId;
  label: string;
  description: string;
  defaultValue?: number | string;
  valueLabel?: string;
  input?: "number" | "text";
};

export const EMAIL_SEGMENT_DEFINITIONS: EmailSegmentDefinition[] = [
  { id: "all_customers", label: "Toute ma base", description: "Tous vos contacts. Seuls les e-mails consentis et valides seront envoyés." },
  { id: "new_customers", label: "Nouveaux clients", description: "Inscrits au cours des 30 derniers jours." },
  { id: "regular_customers", label: "Clients réguliers", description: "Entre 4 et 10 visites." },
  { id: "loyal_customers", label: "Clients fidèles", description: "Au moins 11 visites validées." },
  { id: "at_risk_customers", label: "À réactiver", description: "Dernière visite entre 30 et 60 jours." },
  { id: "dormant_customers", label: "Clients dormants", description: "Aucune visite depuis plus de 60 jours." },
  { id: "lost_customers", label: "Clients perdus", description: "Aucune visite depuis plus de 90 jours." },
  { id: "upcoming_birthday", label: "Anniversaire prochainement", description: "Anniversaire dans les 30 prochains jours.", defaultValue: 30 },
  { id: "available_reward", label: "Récompense disponible", description: "Une récompense gagnée et non utilisée." },
  { id: "close_to_reward", label: "Proches d’une récompense", description: "À deux visites ou moins de la prochaine récompense." },
  { id: "preferred_category", label: "Préférence client", description: "Produit ou catégorie préféré(e), issu(e) du RCU.", input: "text", valueLabel: "préférence" },
  { id: "minimum_visits", label: "Nombre de visites", description: "Choisissez un nombre minimum de visites.", defaultValue: 3, valueLabel: "visites minimum", input: "number" },
  { id: "visits_last_30_days", label: "Visites sur 30 jours", description: "Au moins X visites pendant les 30 derniers jours.", defaultValue: 1, valueLabel: "visites", input: "number" },
  { id: "visits_last_90_days", label: "Visites sur 90 jours", description: "Au moins X visites pendant les 90 derniers jours.", defaultValue: 1, valueLabel: "visites", input: "number" },
  { id: "absent_days", label: "Absents depuis X jours", description: "Choisissez la durée d’absence.", defaultValue: 30, valueLabel: "jours", input: "number" },
  { id: "used_reward", label: "Récompense utilisée", description: "A déjà utilisé au moins une récompense." },
  { id: "minimum_rewards", label: "Au moins X récompenses", description: "A gagné plusieurs récompenses RCU.", defaultValue: 2, valueLabel: "récompenses", input: "number" },
  { id: "registered_via_rcu", label: "Inscrits via le RCU", description: "Contacts collectés depuis une expérience RCU." },
  { id: "visited_this_month", label: "Venus ce mois-ci", description: "Au moins une visite pendant le mois en cours." },
  { id: "five_star_review", label: "Avis 5 étoiles", description: "Clients identifiés avec un avis 5 étoiles." },
  { id: "negative_review", label: "Avis négatif", description: "Clients identifiés avec un avis de 1 ou 2 étoiles." }
];

function differenceInDays(from: Date, to: Date) { return Math.floor((to.getTime() - from.getTime()) / 86_400_000); }

function nextBirthdayDays(birthday: string | null, now: Date) {
  if (!birthday) return null;
  const parsed = new Date(birthday);
  if (Number.isNaN(parsed.getTime())) return null;
  const next = new Date(now.getFullYear(), parsed.getMonth(), parsed.getDate());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(next.getFullYear() + 1);
  return differenceInDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), next);
}

function daysSinceLastVisit(profile: EmailSubscriberProfile, now: Date) {
  if (!profile.lastVisitAt) return Number.POSITIVE_INFINITY;
  const date = new Date(profile.lastVisitAt);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : differenceInDays(date, now);
}

export function matchesEmailSegmentRule(profile: EmailSubscriberProfile, rule: EmailSegmentRule, now = new Date()) {
  const registeredAt = new Date(profile.registeredAt);
  const absentDays = daysSinceLastVisit(profile, now);
  const numericValue = Math.max(1, Number(rule.value ?? 1));
  switch (rule.id) {
    case "all_customers": return true;
    case "new_customers": return !Number.isNaN(registeredAt.getTime()) && differenceInDays(registeredAt, now) <= 30;
    case "regular_customers": return profile.visits >= 4 && profile.visits <= 10;
    case "loyal_customers": return profile.visits >= 11;
    case "inactive_customers": return absentDays >= 30;
    case "at_risk_customers": return absentDays >= 30 && absentDays <= 60;
    case "dormant_customers": return absentDays > 60;
    case "lost_customers": return absentDays > 90;
    case "five_star_review": return profile.reviewRating === 5;
    case "negative_review": return profile.reviewRating !== null && profile.reviewRating <= 2;
    case "minimum_visits": return profile.visits >= numericValue;
    case "visits_last_30_days": return profile.visitsLast30Days >= numericValue;
    case "visits_last_90_days": return profile.visitsLast90Days >= numericValue;
    case "used_reward": return profile.rewardsUsed > 0;
    case "available_reward": return profile.rewardsWon > profile.rewardsUsed;
    case "minimum_rewards": return profile.rewardsWon >= numericValue;
    case "close_to_reward": return profile.visits > 0 && profile.visits % 10 >= 8;
    case "registered_via_rcu": return profile.source === "rcu";
    case "visited_this_month": return Boolean(profile.lastVisitAt && new Date(profile.lastVisitAt).getMonth() === now.getMonth() && new Date(profile.lastVisitAt).getFullYear() === now.getFullYear());
    case "absent_days": return absentDays >= numericValue;
    case "upcoming_birthday": { const days = nextBirthdayDays(profile.birthday, now); return days !== null && days >= 0 && days <= numericValue; }
    case "preferred_category": { const value = String(rule.value ?? "").trim().toLocaleLowerCase("fr-FR"); return Boolean(value) && profile.preferences.some((preference) => preference.toLocaleLowerCase("fr-FR").includes(value)); }
  }
}

export function filterProfilesBySegment(profiles: EmailSubscriberProfile[], rules: EmailSegmentRule[], mode: EmailSegmentMode) {
  if (rules.length === 0) return [];
  return profiles.filter((profile) => mode === "all" ? rules.every((rule) => matchesEmailSegmentRule(profile, rule)) : rules.some((rule) => matchesEmailSegmentRule(profile, rule)));
}

export function filterEmailSubscribers(profiles: EmailSubscriberProfile[], rules: EmailSegmentRule[], mode: EmailSegmentMode) {
  return filterProfilesBySegment(profiles, rules, mode).filter((profile) => profile.emailConsent && profile.emailValid);
}

export function getEmailAudiencePreview(profiles: EmailSubscriberProfile[], rules: EmailSegmentRule[], mode: EmailSegmentMode) {
  const matching = filterProfilesBySegment(profiles, rules, mode);
  const eligible = matching.filter((profile) => profile.emailConsent && profile.emailValid);
  return { matching, eligible, missingConsent: matching.filter((profile) => !profile.emailConsent).length, missingEmail: matching.filter((profile) => profile.emailConsent && !profile.emailValid).length };
}

export function getEmailSegmentLabel(rules: EmailSegmentRule[], mode: EmailSegmentMode) {
  if (rules.length === 0) return "Aucun segment";
  return rules.map((rule) => {
    const definition = EMAIL_SEGMENT_DEFINITIONS.find((item) => item.id === rule.id);
    if (!definition) return rule.id;
    if (rule.id === "preferred_category") return `Préférence : ${rule.value || "à préciser"}`;
    return definition.valueLabel ? `${definition.label.replace("X", String(rule.value ?? definition.defaultValue ?? ""))}` : definition.label;
  }).join(mode === "all" ? " ET " : " OU ");
}
