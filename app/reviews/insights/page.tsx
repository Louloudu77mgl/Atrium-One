import { InsightsPageClient } from "./InsightsPageClient";
import { getAppShellData } from "@/lib/app-shell-data";
import { isDemoMode } from "@/lib/demo-mode";
import { getFallbackReviewInsights, mapInsightRow, prepareReviewInsightsForDisplay, shouldRefreshReviewInsights } from "@/lib/review-insights";
import { getStoredReviewInsights } from "@/lib/review-insights-server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ReviewInsightsPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const storedInsights = hasSupabaseEnv() && !isDemoMode() ? await getStoredReviewInsights(merchant) : null;
  const initialAnalysis = storedInsights
    ? prepareReviewInsightsForDisplay(mapInsightRow(storedInsights), reviews)
    : getFallbackReviewInsights(reviews);

  return (
    <InsightsPageClient
      reviews={reviews}
      merchant={merchant}
      googleConnection={googleConnection}
      initialAnalysis={initialAnalysis}
      initialUpdatedAt={storedInsights?.updated_at ?? null}
      shouldAutoAnalyze={Boolean(
        merchant && reviews.length > 0 && shouldRefreshReviewInsights({ reviews, storedInsights })
      )}
    />
  );
}
