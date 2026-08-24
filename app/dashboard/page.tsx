import { redirect } from "next/navigation";
import { AtriumHubDashboard } from "@/components/AtriumHubDashboard";
import { getGoogleConnectionWithAutoSync } from "@/lib/google-review-auto-sync";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { getMerchant } from "@/lib/merchants";
import { reviews as mockReviews } from "@/lib/mock-data";
import { getFallbackReviewInsights, mapInsightRow, prepareReviewInsightsForDisplay } from "@/lib/review-insights";
import { getStoredReviewInsights } from "@/lib/review-insights-server";
import { getReviews } from "@/lib/reviews";
import { getSocialPosts } from "@/lib/social-posts";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!hasSupabaseEnv() || isDemoMode()) {
    return <AtriumHubDashboard reviews={mockReviews} insights={getFallbackReviewInsights(mockReviews)} socialPosts={[]} />;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const merchant = await getMerchant();

  if (!merchant) {
    redirect("/onboarding");
  }

  const googleConnection = await getGoogleConnectionWithAutoSync(merchant);
  const [reviews, instagramConnection, storedInsights, socialPosts] = await Promise.all([
    getReviews(),
    getInstagramConnection(merchant),
    getStoredReviewInsights(merchant),
    getSocialPosts(merchant)
  ]);
  const visibleInsights = storedInsights
    ? prepareReviewInsightsForDisplay(mapInsightRow(storedInsights), reviews)
    : getFallbackReviewInsights(reviews);

  return <AtriumHubDashboard reviews={reviews} merchant={merchant} googleConnection={googleConnection} instagramConnected={instagramConnection?.status === "connected"} insights={visibleInsights} insightsUpdatedAt={storedInsights?.updated_at ?? null} socialPosts={socialPosts} shouldAutoAnalyze={false} />;
}
