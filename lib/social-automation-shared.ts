export const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;

export function getMaxPostsForCycle(cycleWeeks: number) {
  return Math.max(1, cycleWeeks) * 7;
}

export function normalizeSocialAutomationWindow(settings?: { social_cycle_weeks?: number | null; social_posts_per_cycle?: number | null } | null) {
  const cycleWeeks = clamp(Math.round(settings?.social_cycle_weeks ?? 1), 1, 12);
  const maxPosts = getMaxPostsForCycle(cycleWeeks);
  const postsPerCycle = clamp(Math.round(settings?.social_posts_per_cycle ?? 1), 1, maxPosts);

  return { cycleWeeks, postsPerCycle, maxPosts };
}

export function getRecommendedPublishingDays(businessType?: string | null, postsPerCycle = 3) {
  const normalized = businessType?.toLowerCase() ?? "";
  const preferred = normalized.includes("restaurant") || normalized.includes("boulanger") || normalized.includes("aliment")
    ? [2, 4, 6]
    : normalized.includes("coiff") || normalized.includes("beaute") || normalized.includes("beauté")
      ? [2, 5, 6]
      : normalized.includes("fleur")
        ? [2, 4, 6]
        : [2, 4, 5];

  return preferred.slice(0, Math.max(1, Math.min(postsPerCycle, preferred.length)));
}

export function getRecommendedPublishingSentence(businessType?: string | null, postsPerCycle = 3) {
  const days = getRecommendedPublishingDays(businessType, postsPerCycle).map((value) => DAY_NAMES[value]);

  if (days.length === 1) {
    return `Hans recommande de publier le ${days[0]} pour garder une présence régulière.`;
  }

  return `Hans recommande de publier ${days.join(" et ")} pour garder une présence régulière.`;
}

export function buildAutomationSlots({
  cycleWeeks,
  postsPerCycle,
  businessType,
  fromDate = new Date()
}: {
  cycleWeeks: number;
  postsPerCycle: number;
  businessType?: string | null;
  fromDate?: Date;
}) {
  const slots: Date[] = [];
  const start = new Date(fromDate);
  start.setHours(10, 0, 0, 0);
  const preferredDays = getRecommendedPublishingDays(businessType, Math.min(3, postsPerCycle));

  for (let offset = 0; offset < cycleWeeks * 7 && slots.length < postsPerCycle; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);

    if (preferredDays.includes(date.getDay())) {
      slots.push(date);
    }
  }

  while (slots.length < postsPerCycle) {
    const date = new Date(start);
    date.setDate(start.getDate() + slots.length);
    slots.push(date);
  }

  return slots;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
