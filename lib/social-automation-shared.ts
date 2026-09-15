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
  const count = Math.max(1, Math.min(7, postsPerCycle));
  const patterns: Record<number, number[]> = {
    1: [2],
    2: [2, 5],
    3: [2, 4, 6],
    4: [1, 3, 5, 0],
    5: [1, 2, 4, 5, 0],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 0]
  };
  if (count === 3 && (normalized.includes("coiff") || normalized.includes("beaute") || normalized.includes("beauté"))) {
    return [2, 5, 6];
  }
  return patterns[count];
}

export function getRecommendedPublishingSentence(businessType?: string | null, postsPerCycle = 3) {
  const days = getRecommendedPublishingDays(businessType, postsPerCycle).map((value) => DAY_NAMES[value]);

  if (days.length === 1) {
    return `Hans recommande de publier le ${days[0]} pour garder une présence régulière.`;
  }

  return `Hans recommande de publier ${days.slice(0, -1).join(", ")} et ${days.at(-1)} pour garder une présence régulière.`;
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
  const postsPerWeek = Math.min(7, Math.ceil(postsPerCycle / Math.max(1, cycleWeeks)));
  const preferredDays = getRecommendedPublishingDays(businessType, postsPerWeek);
  const usedTimestamps = new Set<number>();

  for (let offset = 0; offset < cycleWeeks * 7 && slots.length < postsPerCycle; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);

    if (preferredDays.includes(date.getDay())) {
      slots.push(date);
      usedTimestamps.add(date.getTime());
    }
  }

  for (let offset = 0; slots.length < postsPerCycle && offset < cycleWeeks * 7; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    if (!usedTimestamps.has(date.getTime())) {
      slots.push(date);
      usedTimestamps.add(date.getTime());
    }
  }

  return slots.sort((left, right) => left.getTime() - right.getTime());
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
