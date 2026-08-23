import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles } from "@/lib/design-system";
import { isDemoMode } from "@/lib/demo-mode";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { getFallbackReviewInsights } from "@/lib/review-insights";
import type { ReviewSocialPostIdea } from "@/lib/review-insights";
import { getFreshReviewInsights } from "@/lib/review-insights-server";
import { getTopSocialRecommendations } from "@/lib/social-recommendations";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { SocialCreatePostClient } from "./SocialCreatePostClient";

export const dynamic = "force-dynamic";

export default async function SocialCreatePage({
  searchParams
}: {
  searchParams?: Promise<{
    platform?: string;
    title?: string;
    angle?: string;
    source?: string;
    category?: string;
    seasonalMoment?: string;
  }>;
}) {
  const params = await searchParams;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const analysis = hasSupabaseEnv() && !isDemoMode() && merchant && reviews.length > 0
    ? await getFreshReviewInsights(reviews, merchant)
    : getFallbackReviewInsights(reviews);
  const ideas = getTopSocialRecommendations({ analysis, reviews, merchant });
  const initialIdea: ReviewSocialPostIdea | null = params?.title && params.angle
    ? {
        platform: "instagram",
        title: params.title,
        angle: params.angle,
        sourceStrength: params.source || undefined,
        category: params.category || undefined,
        seasonalMoment: params.seasonalMoment || undefined
      }
    : null;

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="social" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className={appShellStyles.width}>
            <SocialCreatePostClient ideas={ideas} initialIdea={initialIdea} />
          </div>
        </main>
      </div>
    </div>
  );
}
