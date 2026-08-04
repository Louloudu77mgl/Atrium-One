import { NextResponse } from "next/server";
import { verifyMakeWebhookRequest } from "@/lib/make-instagram";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

type MakeInstagramCallback = {
  event_id?: string;
  post_id?: string;
  merchant_id?: string;
  status?: "published" | "failed";
  instagram_media_id?: string | null;
  error?: string | null;
};

export async function POST(request: Request) {
  const body = await request.text();
  const authorized = verifyMakeWebhookRequest(
    body,
    request.headers.get("x-atrium-webhook-secret"),
    request.headers.get("x-atrium-signature")
  );

  if (!authorized) {
    return NextResponse.json({ error: "Signature Make invalide." }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Configuration Supabase admin manquante." }, { status: 500 });
  }

  let payload: MakeInstagramCallback;
  try {
    payload = JSON.parse(body) as MakeInstagramCallback;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const postId = payload.post_id ?? payload.event_id;
  if (!postId || !payload.merchant_id || !payload.status) {
    return NextResponse.json({ error: "post_id, merchant_id et status sont requis." }, { status: 400 });
  }
  if (payload.status === "published" && !payload.instagram_media_id) {
    return NextResponse.json({ error: "instagram_media_id est requis pour confirmer une publication." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: existingPost } = await supabase
    .from("social_posts")
    .select("published_at")
    .eq("id", postId)
    .eq("merchant_id", payload.merchant_id)
    .maybeSingle();
  const visiblePublishedAt = existingPost?.published_at && new Date(existingPost.published_at).getTime() > Date.now()
    ? existingPost.published_at
    : now;
  const update = payload.status === "published"
    ? {
        status: "published" as const,
        published_at: visiblePublishedAt,
        scheduled_at: null,
        instagram_media_id: payload.instagram_media_id,
        error_message: null,
        updated_at: now,
        last_saved_at: now
      }
    : {
        status: "ready" as const,
        published_at: null,
        error_message: payload.error ?? "Make n’a pas pu publier ce post.",
        updated_at: now,
        last_saved_at: now
      };

  const { data, error } = await supabase
    .from("social_posts")
    .update(update)
    .eq("id", postId)
    .eq("merchant_id", payload.merchant_id)
    .select("id,status,instagram_media_id,error_message")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, post: data });
}
