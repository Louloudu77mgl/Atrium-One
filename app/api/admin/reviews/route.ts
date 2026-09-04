import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { isDemoMerchant } from "@/lib/demo-merchant";
import { getMerchant } from "@/lib/merchants";
import { mapReviewRow } from "@/lib/reviews";
import { refreshReviewInsightsForMerchant } from "@/lib/refresh-review-insights";
import { analyzeReviewForTesting } from "@/lib/review-status";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MerchantRow } from "@/lib/supabase/types";

async function authorizeReviewManagement(demoOnly = false) {
  if (!hasSupabaseEnv()) {
    return { response: NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 }) };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Connectez-vous pour gérer les avis." }, { status: 401 }) };
  }

  const merchant = await getMerchant();
  if (!merchant) {
    return { response: NextResponse.json({ error: "Commerce introuvable." }, { status: 404 }) };
  }
  if (!isDemoMerchant(merchant) && (demoOnly || !isAdminEmail(user.email))) {
    return { response: NextResponse.json({ error: "Cette action est réservée au compte de démo." }, { status: 403 }) };
  }

  return { merchant, supabase };
}

async function refreshAfterMutation(
  merchant: MerchantRow,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  for (const path of ["/reviews", "/dashboard", "/reviews/insights", "/reports/reputation"]) {
    revalidatePath(path);
  }

  try {
    const { data, error } = await supabase.from("reviews").select("*")
      .eq("merchant_id", merchant.id).order("created_at", { ascending: false });
    if (error) throw error;

    await refreshReviewInsightsForMerchant({
      merchant,
      reviews: (data ?? []).map((review, index) => mapReviewRow(review, index))
    });
    return { insightsUpdated: true, insightsError: null };
  } catch {
    // The mutation succeeded. Do not invite a duplicate mutation if only the
    // derived analysis failed; its version check refreshes it on the next visit.
    return { insightsUpdated: false, insightsError: "L’analyse sera actualisée à la prochaine consultation." };
  }
}

export async function POST(request: Request) {
  const access = await authorizeReviewManagement();
  if (access.response) return access.response;
  const { merchant, supabase } = access;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Données de l’avis invalides." }, { status: 400 });
  }

  const input = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const authorName = typeof input.author_name === "string" ? input.author_name.trim() : "";
  const reviewText = typeof input.review_text === "string" ? input.review_text.trim() : "";
  const rating = input.rating;

  if (!authorName || authorName.length > 120 || !reviewText || reviewText.length > 5000 ||
    typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Renseignez un nom (120 caractères maximum), un avis (5 000 caractères maximum) et une note entière entre 1 et 5." }, { status: 400 });
  }

  const analysis = analyzeReviewForTesting({ rating, text: reviewText });
  const { data, error } = await supabase.from("reviews").insert({
    merchant_id: merchant.id,
    author_name: authorName,
    rating,
    review_text: reviewText,
    source: "manual",
    source_review_id: null,
    sentiment: analysis.sentiment,
    status: analysis.status
  }).select("*").single();

  if (error) {
    return NextResponse.json({ error: "Impossible d’enregistrer l’avis." }, { status: 500 });
  }

  const insights = await refreshAfterMutation(merchant, supabase);
  return NextResponse.json({ review: mapReviewRow(data, 0), ...insights }, { status: 201 });
}

export async function DELETE(request: Request) {
  const access = await authorizeReviewManagement(true);
  if (access.response) return access.response;
  const { merchant, supabase } = access;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Données de l’avis invalides." }, { status: 400 });
  }

  const reviewId = payload && typeof payload === "object" ? (payload as Record<string, unknown>).review_id : undefined;
  if (typeof reviewId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewId)) {
    return NextResponse.json({ error: "Identifiant d’avis invalide." }, { status: 400 });
  }

  // RLS still applies; both IDs are required. Related replies cascade in SQL.
  // This only removes the local record and never calls Google's API.
  const { data, error } = await supabase.from("reviews").delete()
    .eq("merchant_id", merchant.id).eq("id", reviewId).select("id").maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Impossible de supprimer l’avis." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Avis introuvable pour ce compte." }, { status: 404 });
  }

  const insights = await refreshAfterMutation(merchant, supabase);
  return NextResponse.json({ deletedReviewId: data.id, ...insights });
}
