import { NextResponse } from "next/server";
import { generatedReplyFor, testReviewsSeed } from "@/lib/test-reviews-seed";
import { refreshReviewInsightsForMerchant } from "@/lib/refresh-review-insights";
import { mapReviewRow } from "@/lib/reviews";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, MerchantRow, ReviewRow } from "@/lib/supabase/types";

type ResetContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  merchant: MerchantRow;
};

async function getContext(): Promise<{ error: NextResponse } | ResetContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 }) };
  }

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (merchantError || !merchant) {
    return { error: NextResponse.json({ error: merchantError?.message ?? "Merchant introuvable." }, { status: 404 }) };
  }

  return { supabase, merchant };
}

async function clearMerchantReviews(): Promise<NextResponse | ResetContext> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Disponible uniquement en développement." }, { status: 403 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
  }

  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, merchant } = context;

  const { data: existingReviews } = await supabase
    .from("reviews")
    .select("id")
    .eq("merchant_id", merchant.id);

  const existingIds = existingReviews?.map((review) => review.id) ?? [];

  if (existingIds.length > 0) {
    await supabase.from("generated_replies").delete().in("review_id", existingIds);
  }

  const { error: deleteError } = await supabase
    .from("reviews")
    .delete()
    .eq("merchant_id", merchant.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return { supabase, merchant };
}

export async function DELETE() {
  const cleared = await clearMerchantReviews();

  if (cleared instanceof NextResponse) {
    return cleared;
  }

  const { merchant } = cleared;

  let insightsUpdated = false;
  let insightsError: string | null = null;

  try {
    await refreshReviewInsightsForMerchant({
      merchant,
      reviews: []
    });
    insightsUpdated = true;
  } catch (error) {
    insightsError = error instanceof Error ? error.message : "Analyse IA non mise à jour.";
  }

  return NextResponse.json({ ok: true, deleted: true, insightsUpdated, insightsError });
}

export async function POST() {
  const cleared = await clearMerchantReviews();

  if (cleared instanceof NextResponse) {
    return cleared;
  }

  const { supabase, merchant } = cleared;

  const now = Date.now();
  const reviewsPayload = testReviewsSeed.map(([author_name, rating, review_text, sentiment, status, daysAgo]) => ({
    merchant_id: merchant.id,
    author_name,
    rating,
    review_text,
    sentiment,
    status,
    created_at: new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  }));

  const { data: insertedReviews, error: insertError } = await supabase
    .from("reviews")
    .insert(reviewsPayload)
    .select("id, author_name, status");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const repliesPayload: Database["public"]["Tables"]["generated_replies"]["Insert"][] = [];

  insertedReviews.forEach((review: Pick<ReviewRow, "id" | "author_name" | "status">) => {
    const replyText = generatedReplyFor(review.author_name, review.status);

    if (replyText) {
      repliesPayload.push({
        review_id: review.id,
        generated_text: replyText,
        reply_text: replyText,
        status: review.status === "repondu" ? "published" : review.status === "ready_to_publish" ? "approved" : "generated",
        is_edited: false,
        edited_at: null
      });
    }
  });

  if (repliesPayload.length > 0) {
    const { error: repliesError } = await supabase.from("generated_replies").insert(repliesPayload);
    if (repliesError) {
      return NextResponse.json({ error: repliesError.message }, { status: 500 });
    }
  }

  const { data: refreshedReviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  let insightsUpdated = false;
  let insightsError: string | null = null;

  try {
    await refreshReviewInsightsForMerchant({
      merchant,
      reviews: (refreshedReviews ?? []).map((review: ReviewRow, index: number) => mapReviewRow(review, index))
    });
    insightsUpdated = true;
  } catch (error) {
    insightsError = error instanceof Error ? error.message : "Analyse IA non mise à jour.";
  }

  return NextResponse.json({ ok: true, inserted: insertedReviews.length, replies: repliesPayload.length, insightsUpdated, insightsError });
}
