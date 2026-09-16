import type { SupabaseClient } from "@supabase/supabase-js";
import { STORY_LAYOUTS } from "@/lib/story-editorial";
import { getBrandSettings } from "@/lib/brand-settings";
import { resolveHansVisual } from "@/lib/hans-visual-source";
import { getValidInstagramAccessToken } from "@/lib/instagram-tokens";
import { generateDraftContent, type DraftIdeaInput } from "@/lib/social-drafts";
import { withRecommendationOrigin } from "@/lib/social-recommendation-shared";
import {
  attachSocialRecommendationToPost,
  releaseSocialRecommendationReservation,
  reserveSocialRecommendation
} from "@/lib/social-recommendation-usage";
import { composeAndStoreInstagramStoryVisual } from "@/lib/social-visuals";
import type { Database, Json, MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export async function createInstagramStoryDraft({
  merchant,
  idea,
  source = "manual",
  scheduledAt = null,
  autoPublish = false,
  supabaseClient
}: {
  merchant: MerchantRow;
  idea: DraftIdeaInput;
  source?: "manual" | "automation";
  scheduledAt?: string | null;
  autoPublish?: boolean;
  supabaseClient: SupabaseClient<Database>;
}) {
  const storyIdea: DraftIdeaInput = { ...idea, platform: "instagram", contentType: "story" };
  // Check publishing eligibility before spending credits on content generation.
  let connectionId: string | null = null;
  if (autoPublish || scheduledAt) {
    const { connection } = await getValidInstagramAccessToken({ merchantId: merchant.id, supabaseClient });
    if (connection.instagram_account_type !== "BUSINESS") {
      throw new Error("Les Stories via Meta nécessitent un compte Entreprise (Business). Choisissez Prévisualiser pour créer et télécharger votre Story, ou passez le compte Instagram en Entreprise.");
    }
    connectionId = connection.id;
  }
  const { data: latestStories } = await supabaseClient.from("social_posts").select("builder_state")
    .eq("merchant_id", merchant.id).eq("media_kind", "story").order("created_at", { ascending: false }).limit(1);
  const previousState = latestStories?.[0]?.builder_state;
  const previousLayout = previousState && typeof previousState === "object" && !Array.isArray(previousState) ? previousState.layout : null;
  const layout = STORY_LAYOUTS[(STORY_LAYOUTS.findIndex((item) => item === previousLayout) + 1) % STORY_LAYOUTS.length];
  const reservation = await reserveSocialRecommendation({ merchantId: merchant.id, idea: storyIdea, supabaseClient });
  try {
    const generated = await generateDraftContent({
        merchant,
        idea: {
          ...storyIdea,
          platform: "instagram",
          contentType: "story",
          angle: `${idea.angle ?? idea.title ?? "Actualité du commerce"}. Concevoir ce contenu pour une Story Instagram verticale, immédiate, très visuelle et lisible en quelques secondes.`,
          visualDirection: `${idea.visualDirection ?? ""} Composition verticale 9:16, sujet principal placé hors des zones d’interface Instagram.`.trim()
        },
        supabaseClient
      });
    const brand = generated.brand ?? await getBrandSettings(merchant, supabaseClient);
    const visual = await resolveHansVisual({
      merchant,
      title: generated.draft.title,
      caption: generated.draft.caption,
      visualPrompt: generated.draft.visualPrompt,
      subject: [storyIdea.title, storyIdea.angle, storyIdea.source, storyIdea.category, storyIdea.visualDirection].filter(Boolean).join(" · "),
      preferredCategoryName: generated.draft.mediaCategory,
      styleOverride: brand?.visual_style,
      brandSettings: brand,
      format: "story",
      supabaseClient
    });
    if (!visual.imageUrl) throw new Error("Ajoutez une photo à votre médiathèque ou autorisez les photos IA avant de créer cette Story.");
    const readyVisualUrl = await composeAndStoreInstagramStoryVisual({
      merchant,
      imageUrl: visual.imageUrl,
      visualHook: generated.draft.visualHook,
      subtitle: generated.draft.visualSubtitle,
      cta: generated.draft.cta,
      editorial: generated.draft.storyEditorial,
      layout,
      supabaseClient
    });

    const now = new Date().toISOString();
    const storyState = withRecommendationOrigin({
      version: 1,
      kind: "instagram-story",
      template: "editorial-newsletter-v1",
      layout,
      editorial: generated.draft.storyEditorial ?? null,
      format: { width: 1080, height: 1920 },
      visualHook: generated.draft.visualHook,
      visualSubtitle: generated.draft.visualSubtitle,
      sourceImageUrl: visual.imageUrl
    } as unknown as Json, storyIdea);
    const { data: post, error } = await supabaseClient.from("social_posts").insert({
      merchant_id: merchant.id,
      platform: "instagram",
      media_kind: "story",
      title: generated.draft.title,
      caption: generated.draft.caption,
      cta: generated.draft.cta,
      hashtags: generated.draft.hashtags,
      image_url: visual.imageUrl,
      visual_url: readyVisualUrl,
      visual_text: generated.draft.visualHook,
      visual_html: null,
      builder_state: storyState,
      source,
      source_asset_id: visual.sourceAssetId,
      status: scheduledAt ? "scheduled" : "draft",
      scheduled_at: scheduledAt,
      instagram_connection_id: connectionId,
      primary_color: brand?.primary_color ?? "#4C1D95",
      secondary_color: brand?.secondary_color ?? "#F3E8FF",
      accent_color: brand?.accent_color ?? "#A855F7",
      last_saved_at: now,
      updated_at: now
    }).select("*").single();
    if (error || !post) throw new Error(error?.message ?? "La Story n’a pas pu être enregistrée.");
    try {
      await attachSocialRecommendationToPost({ reservation, post, supabaseClient });
    } catch (attachError) {
      await supabaseClient.from("social_posts").delete().eq("id", post.id).eq("merchant_id", merchant.id);
      throw attachError;
    }
    return post as SocialPostRow;
  } catch (error) {
    await releaseSocialRecommendationReservation(reservation, supabaseClient);
    throw error;
  }
}
