import { NextResponse } from "next/server";
import sharp from "sharp";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const EXPORT_DIMENSIONS = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  a4: { width: 1240, height: 1754 }
} as const;

function getExportDimensions(format: unknown, builderState: unknown, templateId: string | null) {
  if (templateId === "rcu-poster") {
    return EXPORT_DIMENSIONS.a4;
  }

  if (typeof format === "string" && format in EXPORT_DIMENSIONS) {
    return EXPORT_DIMENSIONS[format as keyof typeof EXPORT_DIMENSIONS];
  }

  if (builderState && typeof builderState === "object" && !Array.isArray(builderState)) {
    const format = (builderState as { format?: unknown }).format;
    if (typeof format === "string" && format in EXPORT_DIMENSIONS) {
      return EXPORT_DIMENSIONS[format as keyof typeof EXPORT_DIMENSIONS];
    }
  }

  return EXPORT_DIMENSIONS.square;
}

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
    .select("status,published_at,builder_state,template_id")
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  const payload = await request.json() as { imageDataUrl?: string; visualHtml?: string; sourceImageUrl?: string; format?: string };
  const imageDataUrl = payload.imageDataUrl ?? "";
  const base64 = imageDataUrl.split(",")[1];
  let visualUrl = payload.sourceImageUrl ?? null;

  if (!visualUrl) {
    if (!imageDataUrl.startsWith("data:image/png;base64,") || !base64) {
      return NextResponse.json({ error: "PNG invalide." }, { status: 400 });
    }

    const dimensions = getExportDimensions(payload.format, existingPost?.builder_state, existingPost?.template_id ?? null);
    const normalizedPng = await sharp(Buffer.from(base64, "base64"))
      .resize(dimensions.width, dimensions.height, { fit: "fill" })
      .png()
      .toBuffer();
    const path = `${user.id}/${postId}/visual-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("social-visuals")
      .upload(path, normalizedPng, {
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
