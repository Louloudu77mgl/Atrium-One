import { NextResponse } from "next/server";
import { getAutomationSettings } from "@/lib/automation-settings";
import { getReviewAutomationDecision } from "@/lib/review-automation";
import { HANS_REVIEW_REPLY_INSTRUCTIONS } from "@/lib/hans-review-reply-prompt";
import { sanitizeHansHtml } from "@/lib/sanitize-hans-html";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type HansReplyRequest = {
  review_id?: string;
  review_text?: string;
  rating?: number;
  author_name?: string;
  merchant_name?: string;
  business_type?: string;
  response_tone?: string;
};

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante." },
      { status: 500 }
    );
  }

  const reviewId = new URL(request.url).searchParams.get("review_id");

  if (!reviewId) {
    return NextResponse.json(
      { error: "review_id est requis." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur non connecté." },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("generated_replies")
    .select("id, reply_text, generated_text, status, is_edited, edited_at, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Aucune réponse générée pour cet avis.", reply: null },
      { status: 404 }
    );
  }

  return NextResponse.json({
    reply_id: data.id,
    reply_text: data.reply_text,
    generated_text: data.generated_text,
    reply_status: data.status,
    is_edited: data.is_edited,
    edited_at: data.edited_at,
    created_at: data.created_at
  });
}

type OpenAIResponseContent = {
  type?: string;
  text?: string;
};

type OpenAIResponseOutput = {
  type?: string;
  content?: OpenAIResponseContent[];
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
  error?: {
    message?: string;
  };
};

function extractReply(body: OpenAIResponseBody) {
  if (body.output_text) {
    return body.output_text.trim();
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

export async function POST(request: Request) {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

  if (!openAiApiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY manquante. Ajoutez-la dans .env.local." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as HansReplyRequest;
  const reviewText = payload.review_text?.trim();
  const rating = Number(payload.rating);
  const authorName = payload.author_name?.trim();
  const merchantName = payload.merchant_name?.trim() || "votre boutique";
  const businessType = payload.business_type?.trim();
  const responseTone = payload.response_tone?.trim() || "chaleureux";

  if (!reviewText || !rating || !businessType) {
    return NextResponse.json(
      { error: "review_text, rating et business_type sont requis." },
      { status: 400 }
    );
  }

  const prompt = [
    `Commerce: ${merchantName}`,
    `Type de commerce: ${businessType}`,
    `Ton de réponse souhaité: ${responseTone}`,
    `Nom du client: ${authorName || "non renseigné"}`,
    `Note de l'avis: ${rating}/5`,
    `Avis client: ${reviewText}`
  ].join("\n");

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: HANS_REVIEW_REPLY_INSTRUCTIONS,
      input: prompt,
      max_output_tokens: 300
    })
  });

  const responseBody = (await openAiResponse.json()) as OpenAIResponseBody;

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error: responseBody.error?.message ?? "OpenAI n'a pas pu générer la réponse."
      },
      { status: openAiResponse.status }
    );
  }

  const replyText = sanitizeHansHtml(extractReply(responseBody));

  if (!replyText) {
    return NextResponse.json(
      { error: "OpenAI a retourné une réponse vide." },
      { status: 502 }
    );
  }

  let saved = false;
  let saveError: string | undefined;
  let replyId: string | undefined;
  let persistedReplyStatus: string | undefined;
  let persistedReviewStatus: string | undefined;

  if (payload.review_id && hasSupabaseEnv()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const settings = await getAutomationSettings();
      const decision = getReviewAutomationDecision({
        rating,
        reviewText,
        settings
      });
      const replyStatus =
        decision.blockedBySafety
          ? "blocked_by_safety"
          : decision.requiresValidation
            ? "validation_required"
            : "generated";
      const reviewStatus =
        decision.blockedBySafety
          ? "blocked_by_safety"
          : decision.requiresValidation
            ? "validation_required"
            : "generated";
      persistedReplyStatus = replyStatus;
      persistedReviewStatus = reviewStatus;

      const { error: supersedeError } = await supabase
        .from("generated_replies")
        .update({ status: "superseded" })
        .eq("review_id", payload.review_id)
        .in("status", ["generated", "selected", "approved", "validation_required", "blocked_by_safety"]);

      if (supersedeError) {
        saveError = supersedeError.message;
      } else {
        const { data: insertedReply, error: insertError } = await supabase
          .from("generated_replies")
          .insert({
            review_id: payload.review_id,
            generated_text: replyText,
            reply_text: replyText,
            status: replyStatus,
            is_edited: false,
            edited_at: null
          })
          .select("id")
          .single();

        if (insertError) {
          saveError = insertError.message;
        } else {
          replyId = insertedReply.id;

          const { error: reviewUpdateError } = await supabase
            .from("reviews")
            .update({ status: reviewStatus })
            .eq("id", payload.review_id);

          if (reviewUpdateError) {
            saveError = reviewUpdateError.message;
          } else {
            saved = true;
          }
        }
      }
    }
  }

  return NextResponse.json({
    reply_text: replyText,
    reply_id: replyId,
    reply_status: persistedReplyStatus,
    review_status: persistedReviewStatus,
    is_edited: false,
    saved,
    save_error: saveError
  });
}
