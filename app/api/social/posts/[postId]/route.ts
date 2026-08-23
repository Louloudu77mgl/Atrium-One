import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { getMerchant } from "@/lib/merchants";
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

  const [{ data, error }, brandSettings] = await Promise.all([
    supabase
      .from("social_posts")
      .select("*")
      .eq("id", postId)
      .eq("merchant_id", merchant.id)
      .single(),
    getBrandSettings(merchant)
  ]);

  if (error || !data) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    post: data,
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      business_type: merchant.business_type,
      city: merchant.city,
      logo_url: merchant.logo_url
    },
    brandSettings
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
    "title" | "caption" | "cta" | "hashtags" | "template_id" | "visual_text" | "visual_url" | "image_url" | "primary_color" | "secondary_color" | "accent_color" | "visual_html" | "builder_state" | "status" | "scheduled_at" | "published_at" | "error_message"
  >>;
  const now = new Date().toISOString();
  const { data: existingPost } = await supabase
    .from("social_posts")
    .select("status,published_at,scheduled_at")
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  const nextUpdate = {
    ...payload,
    updated_at: now,
    last_saved_at: now
  } as Partial<SocialPostRow> & { updated_at: string; last_saved_at: string };

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
