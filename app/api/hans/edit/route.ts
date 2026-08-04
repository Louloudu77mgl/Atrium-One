import { NextResponse } from "next/server";
import { sanitizeHansHtml } from "@/lib/sanitize-hans-html";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type EditReplyRequest = {
  review_id?: string;
  reply_id?: string;
  reply_text?: string;
};

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as EditReplyRequest;
  const replyText = sanitizeHansHtml(payload.reply_text ?? "");

  if (!payload.review_id || !payload.reply_id || !replyText) {
    return NextResponse.json(
      { error: "review_id, reply_id et reply_text sont requis." },
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
    .update({
      reply_text: replyText,
      is_edited: true,
      edited_at: new Date().toISOString()
    })
    .eq("id", payload.reply_id)
    .eq("review_id", payload.review_id)
    .select("id, reply_text, generated_text, is_edited, edited_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reply_id: data.id,
    reply_text: data.reply_text,
    generated_text: data.generated_text,
    is_edited: data.is_edited,
    edited_at: data.edited_at
  });
}
