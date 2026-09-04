import { emptyAnalysis, mapInsightRow } from "@/lib/review-insights";
import { analyzeReviewsWithOpenAI, saveReviewInsights } from "@/lib/review-insights-server";
import type { Review } from "@/lib/mock-data";
import type { MerchantRow } from "@/lib/supabase/types";

export async function refreshReviewInsightsForMerchant({
  merchant,
  reviews
}: {
  merchant: MerchantRow;
  reviews: Review[];
}) {
  if (reviews.length === 0) {
    const saved = await saveReviewInsights(merchant, emptyAnalysis, []);

    return {
      analysis: mapInsightRow(saved),
      updated_at: saved.updated_at
    };
  }

  const analysis = await analyzeReviewsWithOpenAI(reviews, merchant);
  const saved = await saveReviewInsights(merchant, analysis, reviews);

  return {
    analysis: mapInsightRow(saved),
    updated_at: saved.updated_at
  };
}
