import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

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

  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Image manquante." }, { status: 400 });
  }

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Format invalide. PNG, JPG, SVG ou WEBP uniquement." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/${postId}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("social-post-images")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from("social-post-images").getPublicUrl(path);
  const { data: existingPost } = await supabase
    .from("social_posts")
    .select("status,published_at")
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      image_url: publicUrl.publicUrl,
      status: existingPost?.published_at
        ? (new Date(existingPost.published_at).getTime() > Date.now() ? "ready" : "published")
        : existingPost?.status === "scheduled" ? "scheduled" : "editing",
      updated_at: new Date().toISOString(),
      last_saved_at: new Date().toISOString()
    })
    .eq("id", postId)
    .eq("merchant_id", merchant.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: publicUrl.publicUrl });
}
