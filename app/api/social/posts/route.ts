import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { createInitialBuilderState, renderBuilderStateToHtml } from "@/lib/social-builder";
import { getSuggestedMediaAssetsForBusinessType } from "@/lib/media-assets";
import { getMerchant } from "@/lib/merchants";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
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

  const brand = await getBrandSettings(merchant);

  const payload = await request.json() as {
    platform?: "instagram" | "facebook";
    title?: string;
    caption?: string;
    cta?: string;
    hashtags?: string[];
    visual_url?: string | null;
    image_url?: string | null;
    template_id?: string | null;
    visual_text?: string | null;
    builder_state?: unknown;
    scheduled_at?: string | null;
    status?: "draft" | "editing" | "ready" | "saved" | "scheduled";
  };

  if (!payload.title || !payload.caption) {
    return NextResponse.json({ error: "Titre et légende requis." }, { status: 400 });
  }

  const suggestedMedia = await getSuggestedMediaAssetsForBusinessType(merchant.business_type, `${merchant.business_type} ${payload.title} ${payload.caption} ${payload.visual_text ?? ""}`, 9);
  const imageUrl = payload.image_url ?? payload.visual_url ?? suggestedMedia[0]?.url ?? null;
  const builderState: Json = (payload.builder_state as Json | undefined) ?? createInitialBuilderState({
    post: {
      title: payload.title,
      caption: payload.caption,
      cta: payload.cta ?? null,
      visual_text: payload.visual_text ?? payload.title,
      primary_color: brand?.primary_color ?? "#4C1D95",
      secondary_color: brand?.secondary_color ?? "#F3E8FF",
      accent_color: brand?.accent_color ?? "#A855F7"
    },
    merchant,
    brand,
    imageUrl
  });
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      merchant_id: merchant.id,
      platform: payload.platform ?? "instagram",
      title: payload.title,
      caption: payload.caption,
      cta: payload.cta ?? null,
      hashtags: payload.hashtags ?? [],
      visual_url: payload.visual_url ?? null,
      image_url: imageUrl,
      template_id: payload.template_id ?? null,
      visual_text: payload.visual_text ?? payload.caption,
      visual_html: renderBuilderStateToHtml(builderState as ReturnType<typeof createInitialBuilderState>),
      builder_state: builderState,
      primary_color: brand?.primary_color ?? "#4C1D95",
      secondary_color: brand?.secondary_color ?? "#F3E8FF",
      accent_color: brand?.accent_color ?? "#A855F7",
      scheduled_at: payload.scheduled_at ?? null,
      status: payload.status ?? "draft",
      last_saved_at: now,
      updated_at: now
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/social");

  return NextResponse.json({ post: data });
}
