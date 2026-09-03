import { revalidatePath } from "next/cache";
import { preserveRecommendationOrigin } from "@/lib/social-recommendation-shared";
import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { getInstagramFailureCode } from "@/lib/instagram-errors";
import { getMerchant } from "@/lib/merchants";
import { getMerchantMediaAssets } from "@/lib/social-gallery";
import { getValidInstagramAccessToken } from "@/lib/instagram-tokens";
import { getPublishableInstagramImageUrl } from "@/lib/social-post-utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SocialPostRow } from "@/lib/supabase/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
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

  const [{ data, error }, brandSettings, galleryAssets, { data: postImages }] = await Promise.all([
    supabase
      .from("social_posts")
      .select("*")
      .eq("id", postId)
      .eq("merchant_id", merchant.id)
      .single(),
    getBrandSettings(merchant),
    getMerchantMediaAssets(merchant),
    supabase
      .from("social_posts")
      .select("id,image_url,updated_at")
      .eq("merchant_id", merchant.id)
      .not("image_url", "is", null)
  ]);

  if (error || !data) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  const storedUploads = galleryAssets.filter((asset) => asset.source === "upload");
  const legacyUploads = (postImages ?? [])
    .filter((postImage) => postImage.image_url?.includes("/storage/v1/object/public/social-post-images/"))
    .map((postImage) => ({
      id: `post-${postImage.id}`,
      merchant_id: merchant.id,
      url: postImage.image_url!,
      alt_text: "Image précédemment importée pour Instagram",
      category: "Instagram",
      source: "upload" as const,
      created_at: postImage.updated_at
    }));
  const allUploads = [...storedUploads, ...legacyUploads]
    .filter((asset, index, assets) => assets.findIndex((candidate) => candidate.url === asset.url) === index);

  return NextResponse.json({
    post: data,
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      business_type: merchant.business_type,
      city: merchant.city,
      logo_url: merchant.logo_url
    },
    brandSettings,
    galleryAssets: allUploads
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
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

  const payload = await request.json() as Partial<Pick<SocialPostRow,
    "title" | "caption" | "cta" | "hashtags" | "template_id" | "visual_text" | "visual_url" | "image_url" | "primary_color" | "secondary_color" | "accent_color" | "visual_html" | "builder_state" | "status" | "scheduled_at" | "published_at" | "error_message" | "instagram_connection_id" | "failed_at" | "failure_code" | "retry_count"
  >>;
  const now = new Date().toISOString();
  const { data: existingPost } = await supabase
    .from("social_posts")
    .select("status,published_at,scheduled_at,builder_state,visual_text,visual_url,image_url")
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (!existingPost) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  if (payload.status === "scheduled") {
    const scheduledAt = payload.scheduled_at ? new Date(payload.scheduled_at) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Choisissez une date de publication future." }, { status: 400 });
    }

    const prospectivePost = { ...existingPost, ...payload } as SocialPostRow;
    if (!getPublishableInstagramImageUrl(prospectivePost)) {
      return NextResponse.json({ error: "Finalisez le visuel avant de le planifier." }, { status: 409 });
    }

    try {
      const { connection } = await getValidInstagramAccessToken({ merchantId: merchant.id, supabaseClient: supabase });
      payload.instagram_connection_id = connection.id;
      payload.error_message = null;
      payload.failed_at = null;
      payload.failure_code = null;
      payload.retry_count = 0;
    } catch (error) {
      const failureCode = getInstagramFailureCode(error);
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Reconnectez Instagram avant de planifier cette publication.",
        failureCode,
        reconnectRequired: ["token_expired", "token_revoked", "permissions_insufficient", "account_inaccessible", "connection_invalid"].includes(failureCode),
        supportRequired: true
      }, { status: 409 });
    }
  }
  const nextUpdate = {
    ...payload,
    updated_at: now,
    last_saved_at: now
  } as Partial<SocialPostRow> & { updated_at: string; last_saved_at: string };

  if (payload.builder_state !== undefined) {
    nextUpdate.builder_state = preserveRecommendationOrigin(payload.builder_state, existingPost.builder_state);
  }

  if (payload.status === undefined && payload.scheduled_at === undefined) {
    nextUpdate.status = "editing";
  }
  if (existingPost?.published_at) {
    nextUpdate.status = new Date(existingPost.published_at).getTime() > Date.now() ? "ready" : "published";
    nextUpdate.published_at = existingPost.published_at;
  } else if (existingPost?.status === "scheduled" && existingPost.scheduled_at && payload.status !== "scheduled") {
    nextUpdate.status = "scheduled";
    nextUpdate.scheduled_at = existingPost.scheduled_at;
  }

  const { data, error } = await supabase
    .from("social_posts")
    .update(nextUpdate)
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Impossible d’enregistrer le post." }, { status: 500 });
  }

  revalidatePath("/social");

  return NextResponse.json({ post: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
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

  const { error } = await supabase
    .from("social_posts")
    .delete()
    .eq("id", postId)
    .eq("merchant_id", merchant.id);

  if (error) {
    return NextResponse.json({ error: "Impossible de supprimer le post." }, { status: 500 });
  }

  revalidatePath("/social");

  return NextResponse.json({ ok: true });
}
