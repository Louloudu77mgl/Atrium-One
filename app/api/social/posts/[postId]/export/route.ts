import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
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

  const { data: existingPost } = await supabase
    .from("social_posts")
    .select("status,published_at")
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  const payload = await request.json() as { imageDataUrl?: string; visualHtml?: string; sourceImageUrl?: string };
  const imageDataUrl = payload.imageDataUrl ?? "";
  const base64 = imageDataUrl.split(",")[1];
  let visualUrl = payload.sourceImageUrl ?? null;

  if (!visualUrl) {
    if (!imageDataUrl.startsWith("data:image/png;base64,") || !base64) {
      return NextResponse.json({ error: "PNG invalide." }, { status: 400 });
    }

    const path = `${user.id}/${postId}/visual-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("social-visuals")
      .upload(path, Buffer.from(base64, "base64"), {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrl } = supabase.storage.from("social-visuals").getPublicUrl(path);
    visualUrl = publicUrl.publicUrl;
  }

  const { data, error } = await supabase
    .from("social_posts")
    .update({
      visual_url: visualUrl,
      visual_html: "atrium-final-png-v1",
      status: existingPost?.published_at
        ? (new Date(existingPost.published_at).getTime() > Date.now() ? "ready" : "published")
        : existingPost?.status === "scheduled" ? "scheduled" : "saved",
      updated_at: new Date().toISOString(),
      last_saved_at: new Date().toISOString()
    })
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data, visualUrl });
}
