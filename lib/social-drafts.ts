import { redirect } from "next/navigation";
import { withRecommendationOrigin } from "@/lib/social-recommendation-shared";
import { getBrandSettings } from "@/lib/brand-settings";
import { renderBuilderStateToHtml } from "@/lib/social-builder";
import { createGeneratedDesignDocument, serializeDocumentToBuilderState } from "@/lib/social-editor/document";
import { getMerchant } from "@/lib/merchants";
import { composeAndStoreSocialPostVisual, generateAndStoreSocialVisual } from "@/lib/social-visuals";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export type DraftIdeaInput = {
  platform?: "instagram" | "facebook";
  title?: string;
  angle?: string;
  source?: string;
  sourcePainPoint?: string;
  sourceStrength?: string;
  category?: string;
  seasonalMoment?: string;
  localEvent?: string;
  eventDate?: string;
  sourceUrl?: string;
  visualDirection?: string;
  avoidTopics?: string[];
};

type GeneratedDraftContent = {
  title: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visualPrompt: string;
  visualHook: string;
  visualSubtitle: string;
  format: "carré" | "story" | "carrousel simple";
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: { content?: { text?: string }[] }[];
  error?: { message?: string };
};

function getSocialVisualFallbackMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("billing hard limit") || normalized.includes("hard limit") || normalized.includes("quota")) {
    return "Visuel IA non généré : la limite de facturation OpenAI est atteinte. Vous pouvez continuer avec un brouillon sans image ou importer un visuel manuellement.";
  }

  if (normalized.includes("openai_api_key")) {
    return "Visuel IA non généré : la clé OpenAI n’est pas configurée côté serveur.";
  }

  return "Visuel IA non généré pour le moment. Vous pouvez continuer avec un brouillon sans image ou importer un visuel manuellement.";
}

function extractText(body: OpenAIResponseBody) {
  return body.output_text?.trim() || body.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("").trim() || "";
}

function limitText(value: string, maxCharacters: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  const shortened = normalized.slice(0, maxCharacters + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > maxCharacters * 0.65 ? lastSpace : maxCharacters).trim()}…`;
}

function limitWords(value: string, maxWords: number, maxCharacters: number) {
  return limitText(value.split(/\s+/).filter(Boolean).slice(0, maxWords).join(" "), maxCharacters);
}

const reviewReplyLanguage = [
  /merci\s+(?:beaucoup\s+)?pour\s+(?:votre|ce)\s+(?:retour|avis|commentaire|témoignage|partage)/i,
  /merci\s+d['’]avoir\s+(?:partagé|pris\s+le\s+temps)/i,
  /nous\s+sommes\s+ravis\s+d['’](?:apprendre|entendre)/i,
  /votre\s+satisfaction\s+est\s+notre\s+priorité/i,
  /au\s+plaisir\s+de\s+vous\s+accueillir\s+à\s+nouveau/i
];

function soundsLikeReviewReply(value: string) {
  return reviewReplyLanguage.some((pattern) => pattern.test(value));
}

function fallbackDraft(payload: DraftIdeaInput, merchantName: string): GeneratedDraftContent {
  const requestedAngle = payload.angle || "Découvrez ce que nos clients apprécient le plus.";
  const angle = limitText(soundsLikeReviewReply(requestedAngle) ? "Découvrez une facette de notre savoir-faire en boutique." : requestedAngle, 150);
  const personalizedSubtitle = `Une expérience pensée dans les moindres détails, à découvrir chez ${merchantName}.`;
  const visualSubtitle = personalizedSubtitle.length <= 110
    ? personalizedSubtitle
    : "Une expérience locale pensée pour vous, jusque dans les moindres détails.";

  return {
    title: limitText(payload.title || "Un conseil utile", 64),
    caption: `✨ ${angle} Venez le découvrir chez ${merchantName}.`,
    cta: "Venez nous voir",
    hashtags: ["#commerceLocal", "#proximite", "#savoirFaire"],
    visualPrompt: "Une seule scène forte, chaleureuse et lumineuse, avec un sujet principal clairement identifiable et beaucoup d’espace négatif pour une accroche courte.",
    visualHook: limitWords(payload.title || "À découvrir", 6, 40),
    visualSubtitle,
    format: payload.platform === "facebook" ? "carrousel simple" : "carré"
  };
}

function validateDraft(raw: unknown, fallback: GeneratedDraftContent): GeneratedDraftContent {
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  const hashtags = Array.isArray(candidate.hashtags)
    ? candidate.hashtags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean).slice(0, 5)
    : fallback.hashtags;
  const proposedCaption = typeof candidate.caption === "string" && candidate.caption.trim() ? candidate.caption : fallback.caption;
  const caption = limitText(soundsLikeReviewReply(proposedCaption) ? fallback.caption : proposedCaption, 320);
  const candidateSubtitle = (
    typeof candidate.visualSubtitle === "string" && candidate.visualSubtitle.trim()
      ? candidate.visualSubtitle
      : fallback.visualSubtitle
  ).replace(/\s+/g, " ").trim();
  const normalizedCaption = caption.toLocaleLowerCase("fr-FR");
  const normalizedSubtitle = candidateSubtitle.toLocaleLowerCase("fr-FR");
  const visualSubtitle = candidateSubtitle.length < 55
    || candidateSubtitle.length > 110
    || soundsLikeReviewReply(candidateSubtitle)
    || !/[.!?]$/.test(candidateSubtitle)
    || candidateSubtitle.includes("…")
    || candidateSubtitle.includes("...")
    || normalizedCaption === normalizedSubtitle
    || normalizedCaption.includes(normalizedSubtitle)
    ? fallback.visualSubtitle
    : candidateSubtitle;

  return {
    title: limitText(typeof candidate.title === "string" && candidate.title.trim() && !soundsLikeReviewReply(candidate.title) ? candidate.title : fallback.title, 64),
    caption,
    cta: limitWords(typeof candidate.cta === "string" && candidate.cta.trim() ? candidate.cta : fallback.cta, 6, 40),
    hashtags,
    visualPrompt: limitText(typeof candidate.visualPrompt === "string" && candidate.visualPrompt.trim() ? candidate.visualPrompt : fallback.visualPrompt, 360),
    visualHook: limitWords(typeof candidate.visualHook === "string" && candidate.visualHook.trim() && !soundsLikeReviewReply(candidate.visualHook) ? candidate.visualHook : fallback.visualHook, 6, 40),
    visualSubtitle,
    format: candidate.format === "story" || candidate.format === "carrousel simple" ? candidate.format : fallback.format
  };
}

export async function generateDraftContent({
  merchant,
  idea
}: {
  merchant: MerchantRow;
  idea: DraftIdeaInput;
}) {
  const brand = await getBrandSettings(merchant);
  const fallback = fallbackDraft(idea, merchant.business_name);
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!openAiApiKey) {
    return { draft: fallback, brand };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      instructions:
        "Tu crées un post social immédiatement publiable pour un commerce local. Retourne uniquement un JSON valide avec title, caption, cta, hashtags, visualPrompt, visualHook, visualSubtitle, format. DIVERSITÉ OBLIGATOIRE : si idea.avoidTopics est présent, ne reprends ni le même sujet, ni le même angle, ni la même accroche, ni la même structure narrative que ces publications récentes. Une simple reformulation est interdite. DISTINCTION ABSOLUE : un post Instagram n’est jamais une réponse à un avis. Si idea ou source contient un avis client, utilise-le uniquement comme signal éditorial interne pour choisir un sujet ; ne t’adresse jamais à l’auteur de l’avis et ne remercie jamais pour un retour. Interdictions strictes dans title, caption, visualHook et visualSubtitle : « merci pour votre retour », « merci pour votre avis », « merci pour votre commentaire », « merci pour votre témoignage », « merci d’avoir partagé », « nous sommes ravis d’apprendre », « votre satisfaction est notre priorité », ainsi que toute variante équivalente. La caption doit parler au public Instagram du commerce, comme une publication autonome, jamais comme une conversation avec un client ayant laissé un avis. La demande explicite du commerçant dans idea est la priorité absolue : conserve exactement les personnes, sujets, lieux, cadres, objets, actions, quantités, couleurs et détails demandés. Si une personne, un visage, une main, une équipe ou une foule est explicitement demandé, prévois-le clairement dans visualPrompt au lieu de le remplacer. Quand Hans invente seul une publication sans demande visuelle explicite, reste cohérent avec le commerce : une présence humaine naturelle est autorisée si elle sert vraiment la scène, mais évite de l’imposer systématiquement. Si idea contient un événement ou une date, ne présente jamais le commerce comme partenaire ou participant sans information explicite. title : 64 caractères maximum. caption : légende Instagram naturelle de 2 ou 3 phrases, 320 caractères maximum, avec au plus 1 emoji. visualHook : accroche de 3 à 6 mots, 40 caractères maximum. visualSubtitle : une seule phrase éditoriale complète de 55 à 110 caractères, avec sujet, verbe et ponctuation finale. Elle doit être différente de la caption et ne jamais se terminer par des points de suspension. Il est interdit de couper ou tronquer cette phrase. visualPrompt : direction visuelle concrète et originale, fidèle à l’intention du commerçant ; précise le sujet, l’action, le décor/cadre, le cadrage, la lumière et l’ambiance. Respecte la piste visualDirection lorsqu’elle existe et varie franchement les cadrages et les concepts. Évite les compositions génériques répétitives et n'impose pas systématiquement un produit centré. Aucun texte intégré dans l'image. Le résultat doit pouvoir être publié sans réécriture.",
      input: JSON.stringify({
        merchant: {
          businessName: merchant.business_name,
          businessType: merchant.business_type,
          city: merchant.city,
          description: merchant.description
        },
        brand,
        idea
      }),
      max_output_tokens: 900
    })
  });

  const body = (await response.json()) as OpenAIResponseBody;

  if (!response.ok) {
    return { draft: fallback, brand };
  }

  try {
    return { draft: validateDraft(JSON.parse(extractText(body)), fallback), brand };
  } catch {
    return { draft: fallback, brand };
  }
}

export async function createSocialDraftFromIdea({
  merchant,
  idea
}: {
  merchant?: MerchantRow | null;
  idea: DraftIdeaInput;
}) {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    redirect("/onboarding");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { draft, brand } = await generateDraftContent({ merchant: currentMerchant, idea });
  let imageUrl: string | null = null;
  let visualUrl: string | null = null;
  let errorMessage: string | null = null;

  try {
    imageUrl = (await generateAndStoreSocialVisual({
      merchant: currentMerchant,
      title: draft.title,
      caption: draft.caption,
      visualPrompt: draft.visualPrompt,
      source: [idea.source, idea.angle, idea.category, idea.localEvent, idea.eventDate, idea.seasonalMoment, idea.visualDirection].filter(Boolean).join(" · ") || null,
      styleOverride: brand?.visual_style ?? null
    })).imageUrl;
  } catch (error) {
    errorMessage = getSocialVisualFallbackMessage(error);
  }

  if (imageUrl) {
    try {
      visualUrl = await composeAndStoreSocialPostVisual({
        merchant: currentMerchant,
        imageUrl,
        visualHook: draft.visualHook,
        subtitle: draft.visualSubtitle
      });
    } catch {
      errorMessage = errorMessage ?? "Le visuel est disponible, mais sa version finale avec texte n’a pas pu être préparée.";
    }
  }

  const designDocument = createGeneratedDesignDocument({
    title: draft.title,
    caption: draft.caption,
    visualHook: draft.visualHook,
    visualSubtitle: draft.visualSubtitle,
    imageUrl,
    merchant: currentMerchant,
    brandSettings: brand
  });
  const builderPreviewState = serializeDocumentToBuilderState(designDocument);
  const visualHtml = renderBuilderStateToHtml(builderPreviewState);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      merchant_id: currentMerchant.id,
      platform: idea.platform ?? "instagram",
      title: draft.title,
      caption: draft.caption,
      cta: draft.cta,
      hashtags: draft.hashtags,
      visual_url: visualUrl,
      image_url: imageUrl,
      template_id: null,
      visual_text: draft.visualHook,
      visual_html: visualHtml,
      builder_state: withRecommendationOrigin(designDocument, idea),
      error_message: errorMessage,
      primary_color: brand?.primary_color ?? "#4C1D95",
      secondary_color: brand?.secondary_color ?? "#F3E8FF",
      accent_color: brand?.accent_color ?? "#A855F7",
      status: "draft",
      last_saved_at: now,
      updated_at: now
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    post: data as SocialPostRow,
    imageUrl: visualUrl ?? imageUrl
  };
}
