import { getBrandSettings } from "@/lib/brand-settings";
import { generateDraftContent } from "@/lib/social-drafts";
import { mapInsightRow } from "@/lib/review-insights";
import { getStoredReviewInsights } from "@/lib/review-insights-server";
import { getStoredSocialRecommendations } from "@/lib/social-recommendations";
import { renderBuilderStateToHtml } from "@/lib/social-builder";
import { createGeneratedDesignDocument, serializeDocumentToBuilderState } from "@/lib/social-editor/document";
import { buildAutomationSlots, getMaxPostsForCycle, normalizeSocialAutomationWindow } from "@/lib/social-automation-shared";
import { composeAndStoreSocialPostVisual, generateAndStoreSocialVisual } from "@/lib/social-visuals";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MerchantAutomationSettingsRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export async function ensureAutomatedSocialDrafts({
  merchant,
  settings
}: {
  merchant: MerchantRow;
  settings: Partial<MerchantAutomationSettingsRow>;
}) {
  if (!settings.social_auto_publish_enabled) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const window = normalizeSocialAutomationWindow(settings);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data: existingPosts, error: existingError } = await supabase
    .from("social_posts")
    .select("*")
    .eq("merchant_id", merchant.id)
    .eq("source", "automation")
    .in("status", ["draft", "scheduled"])
    .gte("scheduled_at", start.toISOString())
    .order("scheduled_at", { ascending: true });

  if (existingError) {
    throw new Error(existingError.message);
  }

  const currentPosts = existingPosts ?? [];
  if (currentPosts.length > window.postsPerCycle) {
    const idsToDelete = currentPosts.slice(window.postsPerCycle).map((post) => post.id);
    if (idsToDelete.length > 0) {
      await supabase.from("social_posts").delete().in("id", idsToDelete);
    }
  }

  const keptPosts = currentPosts.slice(0, window.postsPerCycle);
  const missingCount = Math.max(0, window.postsPerCycle - keptPosts.length);
  if (missingCount === 0) {
    return keptPosts;
  }

  const storedInsights = await getStoredReviewInsights(merchant);
  const analysis = mapInsightRow(storedInsights);
  const { data: publishedPosts } = await supabase
    .from("social_posts")
    .select("*")
    .eq("merchant_id", merchant.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);
  const ideas = getStoredSocialRecommendations({
    analysis,
    posts: publishedPosts ?? []
  });
  const brand = await getBrandSettings(merchant);
  const plannedDates = buildAutomationSlots({
    cycleWeeks: window.cycleWeeks,
    postsPerCycle: window.postsPerCycle,
    businessType: merchant.business_type,
    fromDate: start
  });
  const takenDates = new Set(keptPosts.map((post) => post.scheduled_at).filter(Boolean));
  const availableDates = plannedDates.filter((date) => !takenDates.has(date.toISOString())).slice(0, missingCount);
  const createdPosts: SocialPostRow[] = [];

  for (let index = 0; index < availableDates.length; index += 1) {
    const idea = ideas[index % Math.max(ideas.length, 1)] ?? {
      platform: "instagram" as const,
      title: `Mettre en avant ${merchant.business_type.toLowerCase()}`,
      angle: "Créer un post simple pour rappeler ce que vos clients apprécient déjà."
    };
    const { draft } = await generateDraftContent({
      merchant,
      idea: {
        platform: "instagram",
        title: idea.title,
        angle: idea.angle,
        source: idea.sourcePainPoint ?? idea.sourceStrength ?? idea.localEvent ?? idea.seasonalMoment ?? "Automatisation Hans",
        visualDirection: idea.visualDirection
      }
    });
    let imageUrl: string | null = null;
    let visualUrl: string | null = null;
    try {
      imageUrl = (await generateAndStoreSocialVisual({
        merchant,
        title: draft.title,
        caption: draft.caption,
        visualPrompt: draft.visualPrompt,
        source: [idea.sourcePainPoint, idea.sourceStrength, idea.localEvent, idea.seasonalMoment, idea.angle, idea.visualDirection].filter(Boolean).join(" · ") || "Automatisation Hans",
        styleOverride: brand?.visual_style ?? null
      })).imageUrl;
    } catch {
      imageUrl = null;
    }
    if (imageUrl) {
      try {
        visualUrl = await composeAndStoreSocialPostVisual({
          merchant,
          imageUrl,
          visualHook: draft.visualHook,
          subtitle: draft.visualSubtitle
        });
      } catch {
        visualUrl = null;
      }
    }
    const designDocument = createGeneratedDesignDocument({
      title: draft.title,
      caption: draft.caption,
      visualHook: draft.visualHook,
      visualSubtitle: draft.visualSubtitle,
      imageUrl,
      merchant,
      brandSettings: brand
    });
    const builderState = serializeDocumentToBuilderState(designDocument);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("social_posts")
      .insert({
        merchant_id: merchant.id,
        platform: "instagram",
        title: draft.title,
        caption: draft.caption,
        cta: draft.cta,
        hashtags: draft.hashtags,
        visual_url: visualUrl,
        image_url: imageUrl,
        source: "automation",
        status: settings.social_auto_publish_live ? "scheduled" : "draft",
        scheduled_at: availableDates[index].toISOString(),
        template_id: null,
        visual_text: draft.visualHook,
        visual_html: renderBuilderStateToHtml(builderState),
        builder_state: designDocument,
        primary_color: brand?.primary_color ?? "#4C1D95",
        secondary_color: brand?.secondary_color ?? "#F3E8FF",
        accent_color: brand?.accent_color ?? "#A855F7",
        last_saved_at: now,
        updated_at: now
      })
      .select("*")
      .single();

    if (!error && data) {
      createdPosts.push(data);
    }
  }

  return [...keptPosts, ...createdPosts];
}

export async function createTriggeredSocialDraft({
  merchant,
  theme,
  source,
  supabaseClient
}: {
  merchant: MerchantRow;
  theme: string;
  source: string;
  supabaseClient: SupabaseClient<Database>;
}) {
  const brand = await getBrandSettings(merchant, supabaseClient);
  const { draft } = await generateDraftContent({
    merchant,
    idea: {
      platform: "instagram",
      title: theme || `L’expérience chez ${merchant.business_name}`,
      angle: "Transformer cet avis client en publication authentique, sans citer le nom du client et sans inventer d’information.",
      source
    }
  });
  const generated = await generateAndStoreSocialVisual({
    merchant,
    title: draft.title,
    caption: draft.caption,
    visualPrompt: draft.visualPrompt,
    source,
    styleOverride: brand?.visual_style ?? null,
    supabaseClient
  });
  const visualUrl = await composeAndStoreSocialPostVisual({
    merchant,
    imageUrl: generated.imageUrl,
    visualHook: draft.visualHook,
    subtitle: draft.visualSubtitle,
    supabaseClient
  });
  const designDocument = createGeneratedDesignDocument({
    title: draft.title,
    caption: draft.caption,
    visualHook: draft.visualHook,
    visualSubtitle: draft.visualSubtitle,
    imageUrl: generated.imageUrl,
    merchant,
    brandSettings: brand
  });
  const builderState = serializeDocumentToBuilderState(designDocument);
  const now = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from("social_posts")
    .insert({
      merchant_id: merchant.id,
      platform: "instagram",
      title: draft.title,
      caption: draft.caption,
      cta: draft.cta,
      hashtags: draft.hashtags,
      visual_url: visualUrl,
      image_url: generated.imageUrl,
      source: "automation",
      status: "draft",
      scheduled_at: null,
      template_id: null,
      visual_text: draft.visualHook,
      visual_html: renderBuilderStateToHtml(builderState),
      builder_state: designDocument,
      primary_color: brand?.primary_color ?? "#4C1D95",
      secondary_color: brand?.secondary_color ?? "#F3E8FF",
      accent_color: brand?.accent_color ?? "#A855F7",
      last_saved_at: now,
      updated_at: now
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
