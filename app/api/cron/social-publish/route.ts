import { NextResponse } from "next/server";
import { publishPostToInstagram } from "@/lib/social-publish";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return runScheduledPublications(request);
}

export async function POST(request: Request) {
  return runScheduledPublications(request);
}

async function runScheduledPublications(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET manquant." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Configuration Supabase admin manquante." }, { status: 500 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const staleClaimCutoff = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  await supabase
    .from("social_posts")
    .update({
      status: "scheduled",
      error_message: "Nouvelle tentative automatique de publication.",
      updated_at: nowIso
    })
    .eq("status", "ready")
    .not("scheduled_at", "is", null)
    .lte("updated_at", staleClaimCutoff);

  const { data: posts, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.all((posts ?? []).map(async (row) => {
    const queuedAt = new Date();
    const { data: queuedPost, error: claimError } = await supabase
      .from("social_posts")
      .update({
        status: "ready",
        published_at: null,
        error_message: null,
        updated_at: queuedAt.toISOString(),
        last_saved_at: queuedAt.toISOString()
      })
      .eq("id", row.id)
      .eq("merchant_id", row.merchant_id)
      .eq("status", "scheduled")
      .lte("scheduled_at", nowIso)
      .select("*")
      .maybeSingle();

    if (claimError) {
      return { id: row.id, status: "error", error: claimError.message };
    }
    if (!queuedPost) {
      return { id: row.id, status: "skipped" };
    }

    try {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("*")
        .eq("id", queuedPost.merchant_id)
        .maybeSingle();

      if (!merchant) {
        throw new Error("Commerce introuvable.");
      }

      const { data: connection } = await supabase
        .from("instagram_connections")
        .select("*")
        .eq("merchant_id", queuedPost.merchant_id)
        .maybeSingle();

      if (connection?.status !== "connected") {
        throw new Error("Connectez le compte Instagram de cet établissement avant de publier.");
      }

      const post = await publishPostToInstagram({
        merchant,
        post: queuedPost,
        instagramConnection: connection,
        supabaseClient: supabase
      });
      return { id: row.id, status: "published", postId: post.id };
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Publication planifiée impossible.";
      await supabase
        .from("social_posts")
        .update({
          status: "scheduled",
          scheduled_at: queuedPost.scheduled_at,
          published_at: null,
          error_message: message,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id)
        .eq("status", "ready");
      return { id: row.id, status: "error", error: message, scheduledAt: queuedPost.scheduled_at };
    }
  }));

  return NextResponse.json({
    ok: true,
    run_at: nowIso,
    processed: results.length,
    results
  });
}
