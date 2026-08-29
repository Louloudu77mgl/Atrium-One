import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getInstagramFailureCode, getInstagramIntegrationErrorDetails } from "@/lib/instagram-errors";
import { publishPostToInstagram } from "@/lib/social-publish";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
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

  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (postError || !post) {
    return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
  }

  if (post.status === "published") {
    return NextResponse.json({ error: "Cette publication a déjà été publiée." }, { status: 409 });
  }
  if (post.status === "publishing") {
    return NextResponse.json({ error: "Cette publication est déjà en cours d’envoi." }, { status: 409 });
  }

  const attemptStartedAt = new Date().toISOString();
  const { data: claimedPost, error: claimError } = await supabase
    .from("social_posts")
    .update({
      status: "publishing",
      last_attempt_at: attemptStartedAt,
      retry_count: (post.retry_count ?? 0) + 1,
      failed_at: null,
      failure_code: null,
      error_message: null,
      updated_at: attemptStartedAt
    })
    .eq("id", post.id)
    .eq("merchant_id", merchant.id)
    .eq("status", post.status)
    .select("*")
    .maybeSingle();

  if (claimError || !claimedPost) {
    return NextResponse.json({ error: "Cette publication est déjà en cours de traitement." }, { status: 409 });
  }

  try {
    const updatedPost = await publishPostToInstagram({ merchant, post: claimedPost, supabaseClient: supabase });
    revalidatePath("/social");
    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publication Instagram impossible.";
    const failureCode = getInstagramFailureCode(error);
    const integration = getInstagramIntegrationErrorDetails(error);
    const now = new Date().toISOString();
    await supabase
      .from("social_posts")
      .update({
        status: "failed",
        published_at: null,
        failed_at: now,
        last_attempt_at: now,
        failure_code: failureCode,
        error_message: message,
        updated_at: now
      })
      .eq("id", claimedPost.id)
      .eq("merchant_id", merchant.id);

    console.error("[instagram/manual-publish] failed", {
      merchantId: merchant.id,
      postId: claimedPost.id,
      action: integration?.action ?? "instagram_publish",
      provider: "meta",
      method: integration?.method ?? "POST",
      endpoint: integration?.endpoint ?? "/{instagram-user-id}/media",
      httpStatus: integration?.http_status ?? null,
      failureCode,
      apiError: integration?.api_error ?? message
    });

    return NextResponse.json({
      error: message,
      failureCode,
      reconnectRequired: ["token_expired", "token_revoked", "permissions_insufficient", "account_inaccessible", "connection_invalid"].includes(failureCode),
      supportRequired: true
    }, { status: 409 });
  }
}
