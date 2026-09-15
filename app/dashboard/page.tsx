import { redirect } from "next/navigation";
import { AtriumHubDashboard } from "@/components/AtriumHubDashboard";
import { getGoogleConnectionWithAutoSync } from "@/lib/google-review-auto-sync";
import { getInstagramConnectionSummary } from "@/lib/instagram-connections";
import { getMerchant } from "@/lib/merchants";
import { reviews as mockReviews } from "@/lib/mock-data";
import { getFallbackReviewInsights, mapInsightRow } from "@/lib/review-insights";
import { getStoredReviewInsights } from "@/lib/review-insights-server";
import { getReviews } from "@/lib/reviews";
import { getSocialPostSummaries } from "@/lib/social-posts";
import { getTopSocialRecommendations } from "@/lib/social-recommendations";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function DashboardPage() {
  if (!hasSupabaseEnv() || isDemoMode()) {
    return <AtriumHubDashboard reviews={mockReviews} insights={getFallbackReviewInsights(mockReviews)} socialPosts={[]} />;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const merchant = await getMerchant(user.id);

  if (!merchant) {
    redirect("/onboarding");
  }

  const [googleConnection, reviews, instagramConnection, storedInsights, socialPosts] = await Promise.all([
    getGoogleConnectionWithAutoSync(merchant),
    getReviews(merchant),
    getInstagramConnectionSummary(merchant),
    getStoredReviewInsights(merchant),
    getSocialPostSummaries(merchant)
  ]);
  const visibleInsights = storedInsights
    ? mapInsightRow(storedInsights)
    : null;

  if (visibleInsights) {
    visibleInsights.socialPostIdeas = await getTopSocialRecommendations({
      analysis: visibleInsights,
      reviews,
      merchant,
      posts: socialPosts,
      enrichWithExternalSources: false
    });
  }

  return <AtriumHubDashboard reviews={reviews} merchant={merchant} googleConnection={googleConnection} instagramConnected={instagramConnection?.status === "connected" || instagramConnection?.status === "expiring"} insights={visibleInsights} insightsUpdatedAt={storedInsights?.updated_at ?? null} socialPosts={socialPosts} shouldAutoAnalyze={false} />;
}
