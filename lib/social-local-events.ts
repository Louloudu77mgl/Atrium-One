import "server-only";

import { unstable_cache } from "next/cache";
import type { MerchantRow } from "@/lib/supabase/types";
import { isUpcomingRecommendation, parisDateKey, recommendationWeek } from "@/lib/social-recommendation-shared";
import { searchLocalEventIdeas } from "@/lib/social-local-event-search";

const weeklyLocalIdeas = unstable_cache(
  async (city: string, businessType: string, week: string) => searchLocalEventIdeas({
    city, businessType, week,
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_SEARCH_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini"
  }),
  ["hans-local-events-weekly-v1"],
  { revalidate: 7 * 24 * 60 * 60 }
);

export async function getUpcomingLocalSocialIdeas(merchant: MerchantRow, referenceDate = new Date()) {
  const city = merchant.city?.trim();
  if (!city || !process.env.OPENAI_API_KEY) return [];
  try {
    const ideas = await weeklyLocalIdeas(city.toLocaleLowerCase("fr-FR"), merchant.business_type, recommendationWeek(referenceDate));
    return ideas.filter((idea) => isUpcomingRecommendation(idea, parisDateKey(referenceDate)));
  } catch (error) {
    console.warn("[hans/local-events] search_unavailable", { city, reason: error instanceof Error ? error.name : "unknown" });
    return [];
  }
}
