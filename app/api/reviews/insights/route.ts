import { NextResponse } from "next/server";
import { mapInsightRow } from "@/lib/review-insights";
import { getOrRefreshReviewInsights } from "@/lib/review-insights-server";
import { getMerchant } from "@/lib/merchants";
import { getReviews } from "@/lib/reviews";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
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

  const reviews = await getReviews(merchant);
  const storedInsights = await getOrRefreshReviewInsights(merchant, reviews);

  return NextResponse.json({
    analysis: mapInsightRow(storedInsights),
    updated_at: storedInsights?.updated_at ?? null,
    next_update: "À l’arrivée ou à la modification d’un avis"
  });
}

export async function POST() {
  return GET();
}
