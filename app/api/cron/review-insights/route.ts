import { NextResponse } from "next/server";
import { emptyAnalysis, getReviewSnapshotSummary, hasReviewInsightsSourceChanged, mapInsightRow } from "@/lib/review-insights";
import { analyzeReviewsWithOpenAI, getStoredReviewInsights, saveReviewInsights } from "@/lib/review-insights-server";
import { mapReviewRow } from "@/lib/reviews";
import { getTopSocialRecommendations } from "@/lib/social-recommendations";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import type { MerchantRow, ReviewInsightRow, SocialPostRow } from "@/lib/supabase/types";
import { hasBusinessFeatureAccessAdmin } from "@/lib/crm/access";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const force = new URL(request.url).searchParams.get("force") === "1";

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Configuration Supabase admin manquante." }, { status: 500 });
  }

  const runAt = new Date();

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
      if (!await hasBusinessFeatureAccessAdmin(merchant.id, "insights")) { results.push({ merchant_id: merchant.id, status: "skipped", message: "Compte ou module Insights désactivé." }); continue; }
      const [
        { data: reviewRows, error: reviewsError },
        { data: postRows, error: postsError }
      ] = await Promise.all([
        supabase
          .from("reviews")
          .select("*")
          .eq("merchant_id", merchant.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("social_posts")
          .select("*")
          .eq("merchant_id", merchant.id)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(100)
      ]);

      if (reviewsError) {
        throw new Error(reviewsError.message);
      }

      if (postsError) {
        throw new Error(postsError.message);
      }

      const reviews = (reviewRows ?? []).map((review, index) => mapReviewRow(review, index));
      const storedInsight = await getStoredReviewInsights(merchant, supabase) as ReviewInsightRow | null;

      if (!force && !hasReviewInsightsSourceChanged(storedInsight, reviews)) {
        results.push({ merchant_id: merchant.id, status: "skipped", message: "Aucun nouvel avis : analyse conservée à l’identique." });
        continue;
      }

      const analysis = reviews.length > 0
        ? await analyzeReviewsWithOpenAI(reviews, merchant)
        : emptyAnalysis;
      const socialPostIdeas = await getTopSocialRecommendations({
        analysis,
        reviews,
        merchant,
        posts: (postRows ?? []) as SocialPostRow[]
      });
      const saved = await saveReviewInsights(merchant, {
        ...analysis,
        socialPostIdeas,
        reviewSnapshot: getReviewSnapshotSummary(reviews)
      }, reviews, supabase);

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

  const hasErrors = results.some((result) => result.status === "error");

  return NextResponse.json({
    ok: !hasErrors,
    run_at: runAt.toISOString(),
    results
  }, { status: hasErrors ? 500 : 200 });
}
