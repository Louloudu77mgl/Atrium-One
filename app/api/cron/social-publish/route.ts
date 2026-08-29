import { NextResponse } from "next/server";
import { getInstagramFailureCode, getInstagramIntegrationErrorDetails } from "@/lib/instagram-errors";
import { createMerchantNotification } from "@/lib/merchant-notifications";
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
      status: "failed",
      failed_at: nowIso,
      failure_code: "publishing_timeout",
      error_message: "La publication est restée inachevée. Relancez-la depuis AtriumOne.",
      updated_at: nowIso
    })
    .eq("status", "publishing")
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
        status: "publishing",
        published_at: null,
        last_attempt_at: queuedAt.toISOString(),
        retry_count: (row.retry_count ?? 0) + 1,
        failed_at: null,
        failure_code: null,
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

      const post = await publishPostToInstagram({
        merchant,
        post: queuedPost,
        supabaseClient: supabase
      });
      return { id: row.id, status: "published", postId: post.id };
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Publication planifiée impossible.";
      const failureCode = getInstagramFailureCode(publishError);
      const integration = getInstagramIntegrationErrorDetails(publishError);
      const failedAt = new Date().toISOString();
      await supabase
        .from("social_posts")
        .update({
          status: "failed",
          scheduled_at: queuedPost.scheduled_at,
          published_at: null,
          failed_at: failedAt,
          failure_code: failureCode,
          error_message: message,
          updated_at: failedAt
        })
        .eq("id", row.id)
        .eq("status", "publishing");
      if (["token_expired", "token_revoked", "permissions_insufficient", "account_inaccessible", "connection_invalid"].includes(failureCode)) {
        await createMerchantNotification({
          supabase,
          merchantId: queuedPost.merchant_id,
          title: "Publication Instagram non envoyée",
          body: "Votre post est conservé. Reconnectez Instagram pour le replanifier."
        });
      }
      console.error("[instagram/scheduled-publish] failed", {
        merchantId: queuedPost.merchant_id,
        postId: row.id,
        action: integration?.action ?? "instagram_publish",
        provider: "meta",
        method: integration?.method ?? "POST",
        endpoint: integration?.endpoint ?? "/{instagram-user-id}/media",
        httpStatus: integration?.http_status ?? null,
        failureCode,
        apiError: integration?.api_error ?? message,
        scheduledAt: queuedPost.scheduled_at
      });
      return { id: row.id, status: "failed", error: message, failureCode, scheduledAt: queuedPost.scheduled_at };
    }
  }));

  return NextResponse.json({
    ok: true,
    run_at: nowIso,
    processed: results.length,
    results
  });
}
