import { NextResponse } from "next/server";
import { getGoogleConnection } from "@/lib/google-connections";
import { getMerchant } from "@/lib/merchants";
import { getFreshGoogleAccessToken } from "@/lib/google-tokens";
import { hansHtmlToPlainText } from "@/lib/sanitize-hans-html";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type PublishRequest = {
  review_id?: string;
  reply_id?: string;
  reply_text?: string;
  mode?: "manual" | "automatic";
};

type ReviewForPublishing = {
  source_review_id?: string | null;
  created_at: string;
  author_name: string;
  rating: number;
};

type GoogleReviewsResponse = {
  reviews?: Array<{
    name?: string;
    createTime?: string;
    starRating?: string;
    reviewer?: { displayName?: string; isAnonymous?: boolean };
  }>;
  nextPageToken?: string;
  error?: { message?: string };
};

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
  }

  const payload = (await request.json()) as PublishRequest;

  if (!payload.review_id || !payload.reply_id || !payload.reply_text) {
    return NextResponse.json({ error: "review_id, reply_id et reply_text sont requis." }, { status: 400 });
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

  const googleConnection = await getGoogleConnection(merchant);

  if (!googleConnection?.access_token_encrypted || !googleConnection.google_location_id) {
    return NextResponse.json(
      { error: "Google Business n’est pas prêt côté serveur. Connectez Google puis resynchronisez les avis." },
      { status: 409 }
    );
  }

  const review = await getReviewForPublishing(supabase, payload.review_id);

  if (!review) {
    return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  }

  let accessToken: string;

  try {
    accessToken = await getFreshGoogleAccessToken(googleConnection, merchant);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Accès Google expiré." }, { status: 401 });
  }

  let googleReviewName: string;

  try {
    googleReviewName = review.source_review_id ?? await resolveGoogleReviewName({
      accessToken,
      locationId: googleConnection.google_location_id,
      review
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d’identifier cet avis sur Google." },
      { status: 409 }
    );
  }

  const replyText = hansHtmlToPlainText(payload.reply_text);

  if (!replyText) {
    return NextResponse.json({ error: "La réponse à publier est vide." }, { status: 400 });
  }

  const publishResponse = await fetch(`https://mybusiness.googleapis.com/v4/${googleReviewName}/reply`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      comment: replyText
    })
  });

  if (!publishResponse.ok) {
    const errorBody = await publishResponse.text();
    return NextResponse.json({ error: errorBody || "Google n’a pas pu publier la réponse." }, { status: publishResponse.status });
  }

  const finalReplyStatus = payload.mode === "automatic" ? "published_auto" : "published_manual";
  const finalReviewStatus = payload.mode === "automatic" ? "published_auto" : "published_manual";

  let { error: replyUpdateError } = await supabase
    .from("generated_replies")
    .update({ status: finalReplyStatus })
    .eq("id", payload.reply_id)
    .eq("review_id", payload.review_id);

  if (isStatusConstraintError(replyUpdateError?.message)) {
    const fallback = await supabase
      .from("generated_replies")
      .update({ status: "published" })
      .eq("id", payload.reply_id)
      .eq("review_id", payload.review_id);
    replyUpdateError = fallback.error;
  }

  if (replyUpdateError) {
    return NextResponse.json({ error: replyUpdateError.message }, { status: 500 });
  }

  let { error: statusUpdateError } = await supabase
    .from("reviews")
    .update({ status: finalReviewStatus })
    .eq("id", payload.review_id);

  if (isStatusConstraintError(statusUpdateError?.message)) {
    const fallback = await supabase
      .from("reviews")
      .update({ status: "repondu" })
      .eq("id", payload.review_id);
    statusUpdateError = fallback.error;
  }

  if (statusUpdateError) {
    return NextResponse.json({ error: statusUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    review_status: finalReviewStatus,
    reply_status: finalReplyStatus
  });
}

async function getReviewForPublishing(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  reviewId: string
): Promise<ReviewForPublishing | null> {
  const fullResult = await supabase
    .from("reviews")
    .select("source_review_id, created_at, author_name, rating")
    .eq("id", reviewId)
    .maybeSingle();

  if (!fullResult.error) {
    return fullResult.data;
  }

  if (!isMissingColumnError(fullResult.error.message)) {
    throw new Error(fullResult.error.message);
  }

  const fallbackResult = await supabase
    .from("reviews")
    .select("created_at, author_name, rating")
    .eq("id", reviewId)
    .maybeSingle();

  if (fallbackResult.error) {
    throw new Error(fallbackResult.error.message);
  }

  return fallbackResult.data;
}

async function resolveGoogleReviewName({
  accessToken,
  locationId,
  review
}: {
  accessToken: string;
  locationId: string;
  review: ReviewForPublishing;
}) {
  let pageToken: string | undefined;
  const expectedTimestamp = new Date(review.created_at).getTime();

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${locationId}/reviews`);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    const data = (await response.json()) as GoogleReviewsResponse;

    if (!response.ok) {
      throw new Error(data.error?.message ?? "Impossible de rechercher cet avis sur Google.");
    }

    const match = data.reviews?.find((googleReview) =>
      Boolean(googleReview.name && googleReview.createTime) &&
      new Date(googleReview.createTime as string).getTime() === expectedTimestamp
    );

    if (match?.name) {
      return match.name;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  throw new Error("Cet avis n’a pas pu être retrouvé sur la fiche Google connectée. Relancez la synchronisation puis réessayez.");
}

function isMissingColumnError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("schema cache") ||
    lower.includes("could not find") && lower.includes("column") ||
    lower.includes("column") && lower.includes("does not exist");
}

function isStatusConstraintError(message?: string) {
  const lower = message?.toLowerCase() ?? "";
  return lower.includes("check constraint") || lower.includes("violates check constraint");
}
