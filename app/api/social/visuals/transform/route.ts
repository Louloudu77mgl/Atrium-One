import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getBrandSettings } from "@/lib/brand-settings";
import { renderBuilderStateToHtml } from "@/lib/social-builder";
import { createGeneratedDesignDocument, serializeDocumentToBuilderState } from "@/lib/social-editor/document";
import { composeAndStoreSocialPostVisual, generateAndStoreSocialVisual } from "@/lib/social-visuals";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const payload = await request.json() as {
    postId?: string;
    title?: string;
    postText?: string;
    visualHook?: string;
    visualSubtitle?: string;
    style?: string;
    visualPrompt?: string;
  };
  try {
    const visual = await generateAndStoreSocialVisual({
      merchant,
      postId: payload.postId ?? null,
      title: payload.title ?? merchant.business_name,
      caption: payload.postText ?? "",
      visualPrompt: payload.visualPrompt ?? null,
      source: payload.postText ?? null,
      styleOverride: payload.style ?? null
    });
    const visualHook = payload.visualHook ?? (payload.title ?? merchant.business_name).slice(0, 40);
    const readyVisualUrl = await composeAndStoreSocialPostVisual({
      merchant,
      imageUrl: visual.imageUrl,
      visualHook,
      subtitle: payload.visualSubtitle ?? "",
      postId: payload.postId ?? null
    });

    if (payload.postId) {
      const brand = await getBrandSettings(merchant);
      const designDocument = createGeneratedDesignDocument({
        title: payload.title ?? merchant.business_name,
        caption: payload.postText ?? "",
        visualHook,
        visualSubtitle: payload.visualSubtitle ?? "",
        imageUrl: visual.imageUrl,
        merchant,
        brandSettings: brand
      });
      const builderState = serializeDocumentToBuilderState(designDocument);
      await supabase
        .from("social_posts")
        .update({
          image_url: visual.imageUrl,
          visual_url: readyVisualUrl,
          visual_text: visualHook,
          builder_state: designDocument,
          visual_html: renderBuilderStateToHtml(builderState),
          updated_at: new Date().toISOString()
        })
        .eq("id", payload.postId)
        .eq("merchant_id", merchant.id);
    }

    return NextResponse.json({ imageUrl: visual.imageUrl, visualUrl: readyVisualUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transformation IA impossible pour le moment." }, { status: 500 });
  }
}
