import { InsightsPageClient } from "./InsightsPageClient";
import { getAppShellData } from "@/lib/app-shell-data";
import { isDemoMode } from "@/lib/demo-mode";
import { getFallbackReviewInsights, mapInsightRow } from "@/lib/review-insights";
import { getOrRefreshReviewInsights } from "@/lib/review-insights-server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ReviewInsightsPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const storedInsights = hasSupabaseEnv() && !isDemoMode() && merchant
    ? await getOrRefreshReviewInsights(merchant, reviews)
    : null;
  const initialAnalysis = storedInsights
    ? mapInsightRow(storedInsights)
    : !hasSupabaseEnv() || isDemoMode()
      ? getFallbackReviewInsights(reviews)
      : null;

  return (
    <InsightsPageClient
      reviews={reviews}
      merchant={merchant}
      googleConnection={googleConnection}
      initialAnalysis={initialAnalysis}
      initialUpdatedAt={storedInsights?.updated_at ?? null}
      initialReviewsCount={storedInsights?.reviews_count ?? reviews.length}
    />
  );
}
