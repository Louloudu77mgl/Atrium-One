import { NextResponse } from "next/server";
import { getGoogleConnection } from "@/lib/google-connections";
import { getMerchant } from "@/lib/merchants";
import { getFreshGoogleAccessToken } from "@/lib/google-tokens";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type PublishRequest = {
  review_id?: string;
  reply_id?: string;
  reply_text?: string;
  mode?: "manual" | "automatic";
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

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("source_review_id")
    .eq("id", payload.review_id)
    .maybeSingle();

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  if (!review?.source_review_id) {
    return NextResponse.json(
      { error: "Cet avis n’a pas encore d’identifiant Google exploitable. La publication réelle nécessite une prochaine synchronisation." },
      { status: 409 }
    );
  }

  let accessToken: string;

  try {
    accessToken = await getFreshGoogleAccessToken(googleConnection, merchant);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Accès Google expiré." }, { status: 401 });
  }

  const publishResponse = await fetch(`https://mybusiness.googleapis.com/v4/${review.source_review_id}/reply`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      comment: payload.reply_text
    })
  });

  if (!publishResponse.ok) {
    const errorBody = await publishResponse.text();
    return NextResponse.json({ error: errorBody || "Google n’a pas pu publier la réponse." }, { status: publishResponse.status });
  }

  const finalReplyStatus = payload.mode === "automatic" ? "published_auto" : "published_manual";
  const finalReviewStatus = payload.mode === "automatic" ? "published_auto" : "published_manual";

  const { error: replyUpdateError } = await supabase
    .from("generated_replies")
    .update({ status: finalReplyStatus })
    .eq("id", payload.reply_id)
    .eq("review_id", payload.review_id);

  if (replyUpdateError) {
    return NextResponse.json({ error: replyUpdateError.message }, { status: 500 });
  }

  const { error: statusUpdateError } = await supabase
    .from("reviews")
    .update({ status: finalReviewStatus })
    .eq("id", payload.review_id);

  if (statusUpdateError) {
    return NextResponse.json({ error: statusUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    review_status: finalReviewStatus,
    reply_status: finalReplyStatus
  });
}
