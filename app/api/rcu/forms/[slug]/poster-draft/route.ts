import { NextResponse } from "next/server";
import { getAppOriginFromHeaders } from "@/lib/auth/google-login";
import { getBrandSettings } from "@/lib/brand-settings";
import { getMerchant } from "@/lib/merchants";
import { createRcuPosterDocument } from "@/lib/rcu";
import { getStoredRcuForm } from "@/lib/rcu-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateAndStoreSocialVisual } from "@/lib/social-visuals";
import type { Json } from "@/lib/supabase/types";

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });

  const form = await getStoredRcuForm(slug);
  if (!form || form.merchant_id !== merchant.id) {
    return NextResponse.json({ error: "RCU introuvable." }, { status: 404 });
  }

  const [brandSettings, origin] = await Promise.all([
    getBrandSettings(merchant).catch(() => null),
    getAppOriginFromHeaders()
  ]);
  const generatedVisual = await generateAndStoreSocialVisual({
    merchant,
    title: form.poster_headline || form.title,
    caption: form.poster_body || form.incentive_text,
    source: "Affiche A4 premium pour inviter les clients en boutique à scanner un QR code et rejoindre le programme de fidélité.",
    visualPrompt: "Créer une photographie ou illustration éditoriale élégante liée au commerce, avec une composition verticale, une zone calme pour le titre et sans texte intégré.",
    styleOverride: brandSettings?.visual_style,
  }).catch(() => null);
  const document = createRcuPosterDocument({
    form,
    origin,
    merchant,
    brandSettings,
    format: "a4",
    heroImageUrl: generatedVisual?.imageUrl ?? null
  });
  const now = new Date().toISOString();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("social_posts").insert({
    merchant_id: merchant.id,
    platform: "instagram",
    title: `Affiche RCU · ${form.poster_headline || form.title}`,
    caption: form.poster_body || form.incentive_text,
    cta: form.cta_label,
    hashtags: [],
    template_id: "rcu-poster",
    status: "editing",
    visual_text: form.poster_headline || form.title,
    image_url: generatedVisual?.imageUrl ?? null,
    builder_state: document as unknown as Json,
    primary_color: brandSettings?.primary_color ?? "#4C1D95",
    secondary_color: brandSettings?.secondary_color ?? "#F3E8FF",
    accent_color: brandSettings?.accent_color ?? "#A855F7",
    last_saved_at: now,
    updated_at: now
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}
