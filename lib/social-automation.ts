import { getBrandSettings } from "@/lib/brand-settings";
import { generateDraftContent } from "@/lib/social-drafts";
import { mapInsightRow } from "@/lib/review-insights";
import { getStoredReviewInsights } from "@/lib/review-insights-server";
import { getReviews } from "@/lib/reviews";
import { getTopSocialRecommendations } from "@/lib/social-recommendations";
import { getSocialPosts } from "@/lib/social-posts";
import { getRecommendationOrigin, readRecommendationOrigin, recommendationWeek, withRecommendationOrigin } from "@/lib/social-recommendation-shared";
import {
  RecommendationAlreadyUsedError,
  attachSocialRecommendationToPost,
  releaseSocialRecommendationForPost,
  releaseSocialRecommendationReservation,
  reserveSocialRecommendation,
  syncSocialRecommendationLifecycleForPost
} from "@/lib/social-recommendation-usage";
import { getValidInstagramAccessToken } from "@/lib/instagram-tokens";
import { renderBuilderStateToHtml } from "@/lib/social-builder";
import { createGeneratedDesignDocument, serializeDocumentToBuilderState } from "@/lib/social-editor/document";
import { buildAutomationSlots, normalizeSocialAutomationWindow } from "@/lib/social-automation-shared";
import { composeAndStoreSocialPostVisual } from "@/lib/social-visuals";
import { resolveHansVisual } from "@/lib/hans-visual-source";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MerchantAutomationSettingsRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export async function ensureAutomatedSocialDrafts({
  merchant,
  settings,
  supabaseClient
}: {
  merchant: MerchantRow;
  settings: Partial<MerchantAutomationSettingsRow>;
  supabaseClient?: SupabaseClient<Database>;
}) {
  if (!settings.social_auto_publish_enabled) {
    return [];
  }

  const supabase = supabaseClient ?? await createServerSupabaseClient();
  const liveConnection = settings.social_auto_publish_live
    ? (await getValidInstagramAccessToken({ merchantId: merchant.id, supabaseClient: supabase })).connection
    : null;
  const window = normalizeSocialAutomationWindow(settings);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const cycleStart = new Date(`${recommendationWeek(start)}T00:00:00.000Z`);
  const { data: existingPosts, error: existingError } = await supabase
    .from("social_posts")
    .select("*")
    .eq("merchant_id", merchant.id)
    .eq("source", "automation")
    .in("status", ["draft", "scheduled", "failed"])
    .gte("scheduled_at", cycleStart.toISOString())
    .order("scheduled_at", { ascending: true });

  if (existingError) {
    throw new Error(existingError.message);
  }

  const currentPosts = existingPosts ?? [];
  if (currentPosts.length > window.postsPerCycle) {
    for (const post of currentPosts.slice(window.postsPerCycle)) {
      await releaseSocialRecommendationForPost({ merchantId: merchant.id, postId: post.id, supabaseClient: supabase });
      const { error: deletionError } = await supabase.from("social_posts").delete().eq("id", post.id).eq("merchant_id", merchant.id);
      if (deletionError) {
        await syncSocialRecommendationLifecycleForPost(post, supabase);
        throw new Error(deletionError.message);
      }
    }
  }

  const keptPosts = currentPosts.slice(0, window.postsPerCycle);
  await Promise.all(keptPosts.map((post) => syncSocialRecommendationLifecycleForPost(post, supabase)));
  const missingCount = Math.max(0, window.postsPerCycle - keptPosts.length);
  if (missingCount === 0) {
    return keptPosts;
  }

  const storedInsights = await getStoredReviewInsights(merchant, supabase);
  const analysis = mapInsightRow(storedInsights);
  const recentPosts = await getSocialPosts(merchant, supabase);

  const reviews = await getReviews(merchant, supabase);
  const ideas = await getTopSocialRecommendations({
    analysis,
    reviews,
    merchant,
    posts: recentPosts ?? []
  });
  const brand = await getBrandSettings(merchant, supabase);
  const plannedDates = buildAutomationSlots({
    cycleWeeks: window.cycleWeeks,
    postsPerCycle: window.postsPerCycle,
    businessType: merchant.business_type,
    fromDate: start
  });
  const takenDates = new Set(keptPosts.map((post) => post.scheduled_at).filter(Boolean));
  const availableDates = plannedDates.filter((date) => !takenDates.has(date.toISOString())).slice(0, missingCount);
  const createdPosts: SocialPostRow[] = [];

  const reservedThemes = new Set(keptPosts.map((post) => readRecommendationOrigin(post.builder_state)?.themeKey).filter(Boolean));
  const availableIdeas = ideas.filter((idea) => !reservedThemes.has(getRecommendationOrigin(idea).themeKey));
  let dateIndex = 0;
  while (dateIndex < availableDates.length && availableIdeas.length > 0) {
    const ideaIndex = availableIdeas.findIndex((candidate) => !candidate.eventDate || candidate.eventDate >= availableDates[dateIndex].toISOString().slice(0, 10));
    if (ideaIndex < 0) break;
    const [idea] = availableIdeas.splice(ideaIndex, 1);
    const draftIdea = {
      platform: "instagram",
      title: idea.title,
      angle: idea.angle,
      source: idea.sourcePainPoint ?? idea.sourceStrength ?? idea.localEvent ?? idea.seasonalMoment ?? "Automatisation Hans",
      sourcePainPoint: idea.sourcePainPoint,
      sourceStrength: idea.sourceStrength,
      localEvent: idea.localEvent,
      seasonalMoment: idea.seasonalMoment,
      eventDate: idea.eventDate,
      sourceUrl: idea.sourceUrl,
      visualDirection: idea.visualDirection,
      avoidTopics: (recentPosts ?? []).slice(0, 20).map((post) => `${post.title} — ${post.caption.slice(0, 140)}`)
    } satisfies Parameters<typeof reserveSocialRecommendation>[0]["idea"];
    let reservation;
    try {
      reservation = await reserveSocialRecommendation({ merchantId: merchant.id, idea: draftIdea, supabaseClient: supabase });
    } catch (error) {
      if (error instanceof RecommendationAlreadyUsedError) continue;
      throw error;
    }

    try {
      const { draft } = await generateDraftContent({ merchant, idea: draftIdea, supabaseClient: supabase });
      let imageUrl: string | null = null;
      let visualUrl: string | null = null;
      let sourceAssetId: string | null = null;
      try {
        const visual = await resolveHansVisual({
          merchant,
          title: draft.title,
          caption: draft.caption,
          visualPrompt: draft.visualPrompt,
          subject: [idea.sourcePainPoint, idea.sourceStrength, idea.localEvent, idea.seasonalMoment, idea.angle, idea.visualDirection].filter(Boolean).join(" · ") || "Automatisation Hans",
          preferredCategoryName: draft.mediaCategory,
          styleOverride: brand?.visual_style ?? null,
          format: "social",
          supabaseClient: supabase
        });
        imageUrl = visual.imageUrl;
        sourceAssetId = visual.sourceAssetId;
      } catch (error) {
        if (settings.social_auto_publish_live) throw error;
      }
      if (imageUrl) {
        try {
          visualUrl = await composeAndStoreSocialPostVisual({
            merchant,
            imageUrl,
            visualHook: draft.visualHook,
            subtitle: draft.visualSubtitle,
            supabaseClient: supabase
          });
        } catch (error) {
          if (settings.social_auto_publish_live) throw error;
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
          instagram_connection_id: liveConnection?.id ?? null,
          scheduled_at: availableDates[dateIndex].toISOString(),
          template_id: null,
          visual_text: draft.visualHook,
          visual_html: renderBuilderStateToHtml(builderState),
          builder_state: withRecommendationOrigin(designDocument, idea),
          primary_color: brand?.primary_color ?? "#4C1D95",
          secondary_color: brand?.secondary_color ?? "#F3E8FF",
          accent_color: brand?.accent_color ?? "#A855F7",
          source_asset_id: sourceAssetId,
          last_saved_at: now,
          updated_at: now
        })
        .select("*")
        .single();

      if (error || !data) throw new Error(error?.message ?? "La publication Instagram n’a pas pu être planifiée.");
      try {
        await attachSocialRecommendationToPost({ reservation, post: data, supabaseClient: supabase });
      } catch (attachError) {
        await supabase.from("social_posts").delete().eq("id", data.id).eq("merchant_id", merchant.id);
        throw attachError;
      }
      createdPosts.push(data);
      dateIndex += 1;
    } catch (error) {
      await releaseSocialRecommendationReservation(reservation, supabase);
      throw error;
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
  const { data: recentPosts } = await supabaseClient
    .from("social_posts")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const existingPosts = (recentPosts ?? []).filter((post) => !["failed", "cancelled"].includes(post.status));
  const editorialLens = triggeredEditorialLenses[existingPosts.length % triggeredEditorialLenses.length];
  const { draft } = await generateDraftContent({
    merchant,
    idea: {
      platform: "instagram",
      title: editorialLens.title,
      angle: `${editorialLens.angle} Utiliser « ${theme || "l’expérience du commerce"} » uniquement comme point de départ, sans citer le client et sans inventer d’information.`,
      source,
      visualDirection: editorialLens.visualDirection,
      avoidTopics: existingPosts.slice(0, 20).map((post) => `${post.title} — ${post.caption.slice(0, 140)}`)
    },
    supabaseClient
  });
  const generated = await resolveHansVisual({
    merchant,
    title: draft.title,
    caption: draft.caption,
    visualPrompt: draft.visualPrompt,
    subject: source,
    preferredCategoryName: draft.mediaCategory,
    styleOverride: brand?.visual_style ?? null,
    format: "social",
    supabaseClient
  });
  const visualUrl = generated.imageUrl ? await composeAndStoreSocialPostVisual({
    merchant,
    imageUrl: generated.imageUrl,
    visualHook: draft.visualHook,
    subtitle: draft.visualSubtitle,
    supabaseClient
  }) : null;
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
      source_asset_id: generated.sourceAssetId,
      last_saved_at: now,
      updated_at: now
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

const triggeredEditorialLenses = [
  {
    title: "Le geste qui change tout",
    angle: "Montrer une étape précise du savoir-faire à travers une scène concrète et utile.",
    visualDirection: "Gros plan vivant sur un geste, un outil ou une matière, avec profondeur et mouvement suggéré."
  },
  {
    title: "Le conseil de la maison",
    angle: "Transformer le signal client en conseil pratique que le public peut retenir immédiatement.",
    visualDirection: "Composition pédagogique et élégante, vue en plongée, avec objets clairement hiérarchisés."
  },
  {
    title: "Dans les coulisses",
    angle: "Raconter un moment de préparation ou d’organisation habituellement invisible pour les clients.",
    visualDirection: "Plan large pris sur le vif dans l’espace de travail, lumière naturelle et cadrage documentaire."
  },
  {
    title: "Le détail de saison",
    angle: "Relier le sujet à une couleur, une matière ou un usage de saison sans inventer de promotion.",
    visualDirection: "Nature morte décentrée, lumière saisonnière, textures riches et espace négatif assumé."
  },
  {
    title: "Une question, une réponse",
    angle: "Répondre à une question pratique que le sujet peut inspirer, dans un langage simple et commerçant.",
    visualDirection: "Scène minimaliste avec un sujet fort, un cadrage frontal propre et un contraste doux."
  },
  {
    title: "L’expérience en situation",
    angle: "Mettre en scène l’usage concret du produit ou du service plutôt que de répéter une promesse générale.",
    visualDirection: "Perspective immersive avec premier plan audacieux, décor crédible et action clairement lisible."
  },
  {
    title: "L’adresse et son quartier",
    angle: "Faire vivre l’ancrage local du commerce à travers son ambiance, son décor ou son environnement.",
    visualDirection: "Cadrage architectural avec vitrine, reflets, lignes urbaines et profondeur de champ."
  },
  {
    title: "Avant le résultat",
    angle: "Montrer la préparation, le choix ou la transformation qui précède le résultat final.",
    visualDirection: "Composition narrative en deux zones naturelles, sans collage, avec progression visuelle claire."
  }
] as const;
