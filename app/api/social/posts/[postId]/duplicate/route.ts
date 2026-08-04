import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
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

  const { data: source, error: sourceError } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (sourceError || !source) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      merchant_id: merchant.id,
      platform: source.platform,
      title: `${source.title} — copie`,
      caption: source.caption,
      cta: source.cta,
      hashtags: source.hashtags,
      visual_url: source.visual_url,
      status: "draft",
      last_saved_at: new Date().toISOString(),
      template_id: source.template_id,
      visual_html: source.visual_html,
      builder_state: source.builder_state,
      visual_text: source.visual_text,
      image_url: source.image_url,
      primary_color: source.primary_color,
      secondary_color: source.secondary_color,
      accent_color: source.accent_color
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Duplication impossible." }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}
