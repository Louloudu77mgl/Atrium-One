import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoredReviewInsights } from "@/lib/review-insights-server";
import { mapInsightRow } from "@/lib/review-insights";
import { getReviews } from "@/lib/reviews";
import { buildAutomationSlots } from "@/lib/social-automation-shared";
import { getSocialPosts } from "@/lib/social-posts";
import { getTopStoryRecommendations } from "@/lib/social-recommendations";
import { recommendationWeek } from "@/lib/social-recommendation-shared";
import { RecommendationAlreadyUsedError } from "@/lib/social-recommendation-usage";
import { createInstagramStoryDraft } from "@/lib/social-stories";
import type { Database, MerchantAutomationSettingsRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export async function ensureAutomatedInstagramStories({
  merchant,
  settings,
  supabaseClient
}: {
  merchant: MerchantRow;
  settings: Partial<MerchantAutomationSettingsRow>;
  supabaseClient: SupabaseClient<Database>;
}) {
  if (!settings.social_stories_auto_publish_enabled) return [];
  const count = Math.min(7, Math.max(1, Math.round(settings.social_stories_per_week ?? 1)));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const weekStart = new Date(`${recommendationWeek(start)}T00:00:00.000Z`);
  const { data: existing, error } = await supabaseClient.from("social_posts").select("*")
    .eq("merchant_id", merchant.id).eq("source", "automation").eq("media_kind", "story")
    .in("status", ["draft", "scheduled", "publishing", "failed", "published"])
    .gte("created_at", weekStart.toISOString()).order("created_at");
  if (error) throw new Error(error.message);
  const current = existing ?? [];
  if (current.length >= count) return current.slice(0, count);

  const [insights, reviews, recentPosts] = await Promise.all([
    getStoredReviewInsights(merchant, supabaseClient),
    getReviews(merchant, supabaseClient),
    getSocialPosts(merchant, supabaseClient)
  ]);
  const ideas = await getTopStoryRecommendations({ analysis: mapInsightRow(insights), reviews, merchant, posts: recentPosts });
  const slots = buildAutomationSlots({ cycleWeeks: 1, postsPerCycle: count, businessType: merchant.business_type, fromDate: start });
  const created: SocialPostRow[] = [];
  let candidateIndex = 0;

  for (let index = current.length; index < count; index += 1) {
    let story: SocialPostRow | null = null;
    while (!story && candidateIndex < ideas.length) {
      const idea = ideas[candidateIndex++];
      try {
        story = await createInstagramStoryDraft({
          merchant,
          idea: {
            platform: "instagram",
            contentType: "story",
            title: idea.title,
            angle: idea.angle,
            source: idea.sourcePainPoint ?? idea.sourceStrength ?? idea.localEvent ?? idea.seasonalMoment ?? "Recommandation Hans",
            sourcePainPoint: idea.sourcePainPoint,
            sourceStrength: idea.sourceStrength,
            category: idea.category,
            seasonalMoment: idea.seasonalMoment,
            localEvent: idea.localEvent,
            eventDate: idea.eventDate,
            sourceUrl: idea.sourceUrl,
            visualDirection: idea.visualDirection,
            avoidTopics: recentPosts.slice(0, 20).map((post) => `${post.title} — ${post.caption.slice(0, 120)}`)
          },
          source: "automation",
          scheduledAt: settings.social_stories_auto_publish_live ? slots[index]?.toISOString() ?? null : null,
          autoPublish: Boolean(settings.social_stories_auto_publish_live),
          supabaseClient
        });
      } catch (storyError) {
        if (storyError instanceof RecommendationAlreadyUsedError) continue;
        throw storyError;
      }
    }
    if (!story) {
      story = await createInstagramStoryDraft({
        merchant,
        idea: {
          platform: "instagram",
          contentType: "story",
          title: `Cette semaine chez ${merchant.business_name}`,
          angle: `Mettre en valeur une facette concrète de ${merchant.business_name} sans inventer d’offre, avec une approche différente des contenus récents.`,
          source: "Calendrier éditorial Hans",
          visualDirection: index % 2 === 0 ? "Scène immersive et chaleureuse." : "Détail éditorial et composition dynamique.",
          avoidTopics: recentPosts.slice(0, 20).map((post) => `${post.title} — ${post.caption.slice(0, 120)}`)
        },
        source: "automation",
        scheduledAt: settings.social_stories_auto_publish_live ? slots[index]?.toISOString() ?? null : null,
        autoPublish: Boolean(settings.social_stories_auto_publish_live),
        supabaseClient
      });
    }
    created.push(story);
  }
  return [...current.slice(0, count), ...created];
}
