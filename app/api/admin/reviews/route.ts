import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { mapReviewRow } from "@/lib/reviews";
import { refreshReviewInsightsForMerchant } from "@/lib/refresh-review-insights";
import { analyzeReviewForTesting } from "@/lib/review-status";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CreateReviewRequest = {
  author_name?: string;
  rating?: number;
  review_text?: string;
};

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as CreateReviewRequest;
  const authorName = payload.author_name?.trim();
  const reviewText = payload.review_text?.trim();
  const rating = Number(payload.rating);
  const analysis = analyzeReviewForTesting({
    rating,
    text: reviewText ?? ""
  });

  if (!authorName || !reviewText || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "author_name, review_text et rating entre 1 et 5 sont requis." },
      { status: 400 }
    );
  }

  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.json(
      { error: "Merchant introuvable pour l'utilisateur connecté." },
      { status: 404 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      merchant_id: merchant.id,
      author_name: authorName,
      rating,
      review_text: reviewText,
      sentiment: analysis.sentiment,
      status: analysis.status
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: allReviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  let insightsUpdated = false;
  let insightsError: string | null = null;

  try {
    await refreshReviewInsightsForMerchant({
      merchant,
      reviews: (allReviews ?? []).map((review, index) => mapReviewRow(review, index))
    });
    insightsUpdated = true;
  } catch (refreshError) {
    insightsError = refreshError instanceof Error ? refreshError.message : "Analyse IA non mise à jour.";
  }

  return NextResponse.json({
    review: mapReviewRow(data, 0),
    insightsUpdated,
    insightsError
  });
}
