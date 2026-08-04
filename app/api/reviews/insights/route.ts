import { NextResponse } from "next/server";
import { mapInsightRow, prepareReviewInsightsForDisplay, shouldRefreshReviewInsights } from "@/lib/review-insights";
import { analyzeReviewsWithOpenAI, getStoredReviewInsights, saveReviewInsights } from "@/lib/review-insights-server";
import { getMerchant } from "@/lib/merchants";
import { getReviews } from "@/lib/reviews";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  }

  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  }

  const reviews = await getReviews();

  if (reviews.length === 0) {
    return NextResponse.json({ error: "Ajoutez ou importez des avis avant de lancer l’analyse." }, { status: 400 });
  }

  const payload = await request.json().catch(() => ({})) as { force?: boolean };
  const storedInsights = await getStoredReviewInsights(merchant);

  if (!payload.force && storedInsights && !shouldRefreshReviewInsights({ reviews, storedInsights })) {
    return NextResponse.json({
      analysis: prepareReviewInsightsForDisplay(mapInsightRow(storedInsights), reviews),
      updated_at: storedInsights.updated_at,
      cached: true
    });
  }

  const analysis = await analyzeReviewsWithOpenAI(reviews, merchant);

  try {
    const saved = await saveReviewInsights(merchant, analysis, reviews);

    return NextResponse.json({
      analysis: prepareReviewInsightsForDisplay(mapInsightRow(saved), reviews),
      updated_at: saved.updated_at
    });
  } catch (error) {
    return NextResponse.json({
      analysis,
      save_error: error instanceof Error ? error.message : "Analyse affichée mais non sauvegardée."
    });
  }
}
