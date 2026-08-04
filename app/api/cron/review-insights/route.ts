import { NextResponse } from "next/server";
import { emptyAnalysis, mapInsightRow, prepareReviewInsightsForDisplay, shouldRefreshReviewInsights } from "@/lib/review-insights";
import { analyzeReviewsWithOpenAI, saveReviewInsights } from "@/lib/review-insights-server";
import { mapReviewRow } from "@/lib/reviews";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import type { MerchantRow, ReviewInsightRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Configuration Supabase admin manquante." }, { status: 500 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: merchants, error: merchantsError } = await supabase
    .from("merchants")
    .select("*")
    .order("created_at", { ascending: true });

  if (merchantsError) {
    return NextResponse.json({ error: merchantsError.message }, { status: 500 });
  }

  const results: Array<{ merchant_id: string; status: "updated" | "skipped" | "error"; message?: string }> = [];

  for (const merchant of merchants as MerchantRow[]) {
    try {
      const [{ data: reviewRows, error: reviewsError }, { data: insightRow, error: insightError }] = await Promise.all([
        supabase
          .from("reviews")
          .select("*")
          .eq("merchant_id", merchant.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("review_insights")
          .select("*")
          .eq("merchant_id", merchant.id)
          .maybeSingle()
      ]);

      if (reviewsError) {
        throw new Error(reviewsError.message);
      }

      if (insightError) {
        throw new Error(insightError.message);
      }

      const reviews = (reviewRows ?? []).map((review, index) => mapReviewRow(review, index));

      if (reviews.length === 0) {
        const saved = await saveReviewInsights(merchant, emptyAnalysis, []);
        results.push({
          merchant_id: merchant.id,
          status: "updated",
          message: `Analyse vidée à ${saved.updated_at} (0 idée)`
        });
        continue;
      }

      if (!shouldRefreshReviewInsights({ reviews, storedInsights: insightRow as ReviewInsightRow | null })) {
        results.push({ merchant_id: merchant.id, status: "skipped" });
        continue;
      }

      const analysis = prepareReviewInsightsForDisplay(await analyzeReviewsWithOpenAI(reviews, merchant), reviews);
      if (!analysis) {
        throw new Error("Analyse vide.");
      }
      const saved = await saveReviewInsights(merchant, analysis, reviews);

      results.push({
        merchant_id: merchant.id,
        status: "updated",
        message: `Analyse mise à jour à ${saved.updated_at} (${mapInsightRow(saved)?.socialPostIdeas.length ?? 0} idées)`
      });
    } catch (error) {
      results.push({
        merchant_id: merchant.id,
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  return NextResponse.json({
    ok: true,
    run_at: new Date().toISOString(),
    results
  });
}
