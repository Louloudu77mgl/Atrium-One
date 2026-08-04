import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { buildAutomaticAltText } from "@/lib/social-gallery";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function POST(request: Request) {
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
  const category = String(formData.get("category") ?? "").trim() || null;
  const altTextInput = String(formData.get("alt_text") ?? "").trim() || null;

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Image manquante." }, { status: 400 });
  }

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Format invalide. PNG, JPG, SVG ou WEBP uniquement." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/gallery/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("social-post-images")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from("social-post-images").getPublicUrl(path);
  const altText = altTextInput ?? buildAutomaticAltText({
    merchantName: merchant.business_name,
    businessType: merchant.business_type,
    category,
    filename: file.name
  });

  const { data, error } = await supabase
    .from("merchant_media_assets")
    .insert({
      merchant_id: merchant.id,
      url: publicUrl.publicUrl,
      alt_text: altText,
      category,
      source: "upload"
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ asset: data });
}
