import { NextResponse } from "next/server";
import { getAppOriginFromHeaders } from "@/lib/auth/google-login";
import { getBrandSettings } from "@/lib/brand-settings";
import { getMerchant } from "@/lib/merchants";
import { createRcuPosterDocument } from "@/lib/rcu";
import { getStoredRcuForm } from "@/lib/rcu-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  const document = createRcuPosterDocument({ form, origin, merchant, brandSettings, format: "square" });
  const now = new Date().toISOString();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("social_posts").insert({
    merchant_id: merchant.id,
    platform: "instagram",
    title: form.poster_headline || form.title,
    caption: form.poster_body || form.incentive_text,
    cta: form.cta_label,
    hashtags: ["#boutique", "#fidelite", "#qrcode"],
    status: "editing",
    visual_text: form.poster_headline || form.title,
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
