import { NextResponse } from "next/server";
import { sanitizeHansHtml } from "@/lib/sanitize-hans-html";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type ValidateRequest = {
  review_id?: string;
  reply_id?: string;
  reply_text?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined) {
  return Boolean(value && uuidPattern.test(value));
}

function isStatusConstraintError(error: { message?: string; code?: string } | null) {
  return Boolean(
    error &&
      (error.code === "23514" ||
        error.message?.includes("generated_replies_status_check") ||
        error.message?.includes("violates check constraint"))
  );
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as ValidateRequest;

  if (!payload.review_id) {
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

  let replyId = isUuid(payload.reply_id) ? payload.reply_id : undefined;
  const replyText = sanitizeHansHtml(payload.reply_text ?? "");

  if (!replyId) {
    if (!replyText) {
      return NextResponse.json(
        { error: "Impossible de valider la réponse pour le moment." },
        { status: 400 }
      );
    }

    const { error: supersedeError } = await supabase
      .from("generated_replies")
      .update({ status: "superseded" })
      .eq("review_id", payload.review_id)
      .in("status", ["generated", "selected", "approved", "validation_required", "blocked_by_safety"]);

    if (supersedeError) {
      return NextResponse.json(
        { error: "Impossible de valider la réponse pour le moment." },
        { status: 500 }
      );
    }

    const insertPayload = {
      review_id: payload.review_id,
      generated_text: replyText,
      reply_text: replyText,
      status: "validation_required" as const,
      is_edited: false,
      edited_at: null
    };

    let { data: insertedReply, error: insertError } = await supabase
      .from("generated_replies")
      .insert(insertPayload)
      .select("id")
      .single();

    if (isStatusConstraintError(insertError)) {
      const fallbackInsert = await supabase
        .from("generated_replies")
        .insert({ ...insertPayload, status: "selected" as const })
        .select("id")
        .single();

      insertedReply = fallbackInsert.data;
      insertError = fallbackInsert.error;
    }

    if (insertError) {
      console.error("Hans validate insert error", insertError);
      return NextResponse.json(
        { error: "Impossible de valider la réponse pour le moment." },
        { status: 500 }
      );
    }

    if (!insertedReply) {
      return NextResponse.json(
        { error: "Impossible de valider la réponse pour le moment." },
        { status: 500 }
      );
    }

    replyId = insertedReply.id;
  }

  let { error: replyError } = await supabase
    .from("generated_replies")
    .update({ status: "validation_required" })
    .eq("id", replyId)
    .eq("review_id", payload.review_id);

  if (isStatusConstraintError(replyError)) {
    const fallbackUpdate = await supabase
      .from("generated_replies")
      .update({ status: "selected" })
      .eq("id", replyId)
      .eq("review_id", payload.review_id);

    replyError = fallbackUpdate.error;
  }

  if (replyError) {
    console.error("Hans validate reply update error", replyError);
    return NextResponse.json(
      { error: "Impossible de valider la réponse pour le moment." },
      { status: 500 }
    );
  }

  const { error: reviewError } = await supabase
    .from("reviews")
    .update({ status: "validation_required" })
    .eq("id", payload.review_id);

  if (reviewError) {
    console.error("Hans validate review update error", reviewError);
    return NextResponse.json(
      { error: "Impossible de valider la réponse pour le moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    reply_id: replyId,
    review_status: "validation_required",
    reply_status: "validation_required",
    message: "Réponse prête à être relue et publiée manuellement."
  });
}
