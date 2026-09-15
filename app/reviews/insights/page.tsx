import { InsightsPageClient } from "./InsightsPageClient";
import { after } from "next/server";
import { getAppShellData } from "@/lib/app-shell-data";
import { isDemoMode } from "@/lib/demo-mode";
import { getFallbackReviewInsights, hasReviewInsightsSourceChanged, mapInsightRow } from "@/lib/review-insights";
import { getOrRefreshReviewInsights, getStoredReviewInsights } from "@/lib/review-insights-server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ReviewInsightsPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const storedInsights = hasSupabaseEnv() && !isDemoMode() && merchant
    ? await getStoredReviewInsights(merchant)
    : null;

  if (hasSupabaseEnv() && !isDemoMode() && merchant && hasReviewInsightsSourceChanged(storedInsights, reviews)) {
    after(async () => {
      await getOrRefreshReviewInsights(merchant, reviews).catch((error) => {
        console.error("[insights/background-refresh] failed", error);
      });
    });
  }
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
