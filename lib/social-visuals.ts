import sharp from "sharp";
import { createElement } from "react";
import { ImageResponse } from "next/og";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrandSettings } from "@/lib/brand-settings";
import { fitEstimatedText } from "@/lib/social-editor/layout-safety";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, MerchantRow } from "@/lib/supabase/types";

type OpenAIImageBody = {
  data?: { b64_json?: string }[];
  error?: { message?: string };
};

const socialFontDataCache = new Map<string, Promise<ArrayBuffer>>();

const SOCIAL_FONT_GOOGLE_FAMILIES: Record<string, string> = {
  Georgia: "Libre Baskerville",
  "Trebuchet MS": "DM Sans",
  "Helvetica Neue": "Inter"
};

async function getSocialFontData(fontFamily: string, weight: 400 | 700): Promise<ArrayBuffer> {
  const googleFamily = SOCIAL_FONT_GOOGLE_FAMILIES[fontFamily] ?? fontFamily;
  const cacheKey = `${googleFamily}:${weight}`;
  const cached = socialFontDataCache.get(cacheKey);
  if (cached) return cached;

  const familyQuery = encodeURIComponent(googleFamily).replaceAll("%20", "+");
  const request: Promise<ArrayBuffer> = fetch(`https://fonts.googleapis.com/css2?family=${familyQuery}:wght@${weight}&display=swap`, {
    headers: { "user-agent": "Mozilla/5.0" },
    next: { revalidate: 604800 }
  }).then(async (cssResponse) => {
    if (!cssResponse.ok) throw new Error(`Police ${googleFamily} inaccessible (${cssResponse.status}).`);
    const css = await cssResponse.text();
    const fontUrl = css.match(/src:\s*url\((https:[^)]+)\)\s*format\(['"]truetype['"]\)/)?.[1];
    if (!fontUrl) throw new Error(`Fichier TTF statique introuvable pour ${googleFamily}.`);
    const fontResponse = await fetch(fontUrl, { next: { revalidate: 604800 } });
    if (!fontResponse.ok) throw new Error(`Fichier ${googleFamily} inaccessible (${fontResponse.status}).`);
    return fontResponse.arrayBuffer();
  }).catch(async (error) => {
    if (weight === 700) return getSocialFontData(fontFamily, 400);
    throw error;
  });
  socialFontDataCache.set(cacheKey, request);
  return request;
}

export async function composeAndStoreSocialPostVisual({
  merchant,
  imageUrl,
  visualHook,
  subtitle,
  postId,
  supabaseClient
}: {
  merchant: MerchantRow;
  imageUrl: string;
  visualHook: string;
  subtitle?: string | null;
  postId?: string | null;
  supabaseClient?: SupabaseClient<Database>;
}) {
  const supabase = supabaseClient ?? await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !supabaseClient) {
    throw new Error("Utilisateur non connecté.");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Le visuel source est inaccessible pour la composition.");
  }

  const brand = await getBrandSettings(merchant, supabaseClient);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const background = brand?.secondary_color ?? "#F3E8FF";
  const primary = brand?.primary_color ?? "#4C1D95";
  const accent = brand?.accent_color ?? "#A855F7";
  const selectedFont = brand?.social_font_family ?? "Sora";
  const showLogo = Boolean(brand?.show_logo_on_social_posts && merchant.logo_url);
  const logoPosition = brand?.social_logo_position ?? "top_left";
  const logoAtBottom = logoPosition.startsWith("bottom");
  const logoOnRight = logoPosition.endsWith("right");
  const safeVisualHook = sanitizeOverlayText(visualHook) || "À découvrir";
  const subtitleText = limitOverlaySubtitle(sanitizeOverlayText(subtitle ?? "") || "Découvrez cette actualité.");
  const rawVariant = Math.abs(hashText(`${safeVisualHook}|${subtitleText}|${merchant.city ?? ""}`)) % 4;
  const variant = showLogo && logoAtBottom && (rawVariant === 0 || rawVariant === 3)
    ? rawVariant === 0 ? 1 : 2
    : showLogo && !logoAtBottom && rawVariant === 1
      ? 3
      : rawVariant;
  const baseInitialLayout = getOverlayLayout(variant, 2);
  const initialLayout = showLogo && logoAtBottom
    ? {
        ...baseInitialLayout,
        signatureX: logoOnRight ? 80 : 200,
        signatureWidth: 760,
        anchor: "start" as const
      }
    : baseInitialLayout;
  const hookFit = fitEstimatedText({
    text: safeVisualHook,
    maxWidth: initialLayout.hookWidth,
    maxHeight: 176,
    maxLines: 2,
    maxFontSize: initialLayout.hookSize,
    minFontSize: 48,
    lineHeight: 1.08,
    fontWeight: 800
  });
  const subtitleFit = fitEstimatedText({
    text: subtitleText,
    maxWidth: initialLayout.subtitleWidth,
    maxHeight: 108,
    maxLines: 3,
    maxFontSize: 27,
    minFontSize: 20,
    lineHeight: 1.28,
    fontWeight: 500
  });
  if (!hookFit || !subtitleFit) {
    throw new Error("Le texte du visuel est trop long pour être cadré sans troncature. Raccourcissez-le avant publication.");
  }

  const baseLayout = getOverlayLayout(variant, hookFit.lines.length);
  const layout = showLogo && logoAtBottom
    ? {
        ...baseLayout,
        signatureX: logoOnRight ? 80 : 200,
        signatureWidth: 760,
        anchor: "start" as const
      }
    : baseLayout;
  const overlay = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="vignette" cx="50%" cy="42%" r="72%">
          <stop offset="50%" stop-color="#120E1C" stop-opacity="0"/>
          <stop offset="100%" stop-color="#120E1C" stop-opacity="0.42"/>
        </radialGradient>
        ${layout.gradient}
      </defs>
      <rect width="1080" height="1080" fill="url(#vignette)"/>
      <rect width="1080" height="1080" fill="url(#shade)"/>
      <rect x="${layout.accentX}" y="${layout.accentY}" width="116" height="6" rx="3" fill="${escapeXml(accent)}"/>
    </svg>
  `);
  const typography = await renderSocialTypography({
    fontFamily: selectedFont,
    hookLines: hookFit.lines,
    hookSize: hookFit.fontSize,
    subtitleLines: subtitleFit.lines,
    subtitleSize: subtitleFit.fontSize,
    layout
  });
  const composites: { input: Buffer; top: number; left: number }[] = [
    { input: overlay, top: 0, left: 0 },
    { input: typography, top: 0, left: 0 }
  ];

  if (showLogo && merchant.logo_url) {
    try {
      const logoResponse = await fetch(merchant.logo_url);
      if (logoResponse.ok) {
        const logoX = logoOnRight ? 904 : 64;
        const logoY = logoAtBottom ? 904 : 64;
        const logoBuffer = await sharp(Buffer.from(await logoResponse.arrayBuffer()))
          .resize(88, 88, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .png()
          .toBuffer();
        const logoBackground = Buffer.from(`
          <svg width="112" height="112" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="110" height="110" rx="22" fill="#FFFFFF" fill-opacity="0.92" stroke="${escapeXml(accent)}" stroke-opacity="0.34" stroke-width="2"/>
          </svg>
        `);
        composites.push(
          { input: logoBackground, top: logoY, left: logoX },
          { input: logoBuffer, top: logoY + 12, left: logoX + 12 }
        );
      }
    } catch {}
  }

  const png = await sharp(imageBuffer)
    .flatten({ background })
    .resize(1080, 1080, {
      fit: "contain",
      background
    })
    .composite(composites)
    .png()
    .toBuffer();
  const path = `${user?.id ?? merchant.id}/${postId ?? "social-ready"}/ready-${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("social-visuals")
    .upload(path, png, {
      contentType: "image/png",
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrl } = supabase.storage.from("social-visuals").getPublicUrl(path);
  return publicUrl.publicUrl;
}

async function renderSocialTypography({
  fontFamily,
  hookLines,
  hookSize,
  subtitleLines,
  subtitleSize,
  layout
}: {
  fontFamily: string;
  hookLines: string[];
  hookSize: number;
  subtitleLines: string[];
  subtitleSize: number;
  layout: {
    hookX: number;
    hookWidth: number;
    firstLineY: number;
    subtitleX: number;
    subtitleY: number;
    subtitleWidth: number;
    anchor: string;
  };
}) {
  const [regularFontData, boldFontData] = await Promise.all([
    getSocialFontData(fontFamily, 400),
    getSocialFontData(fontFamily, 700)
  ]);
  const align = layout.anchor === "middle" ? "center" : "left";
  const hookLeft = layout.anchor === "middle" ? layout.hookX - layout.hookWidth / 2 : layout.hookX;
  const subtitleLeft = layout.anchor === "middle" ? layout.subtitleX - layout.subtitleWidth / 2 : layout.subtitleX;
  const line = (text: string, index: number, size: number) => createElement("div", { key: `${index}-${text}`, style: { height: size * 1.08 } }, text);

  const render = async (regularData: ArrayBuffer, boldData: ArrayBuffer) => {
    const response = new ImageResponse(
      createElement(
        "div",
        { style: { display: "flex", position: "relative", width: "100%", height: "100%", background: "transparent" } },
        createElement(
          "div",
          {
            style: {
              display: "flex",
              position: "absolute",
              flexDirection: "column",
              left: hookLeft,
              top: layout.firstLineY - hookSize * 0.82,
              width: layout.hookWidth,
              color: "white",
              fontFamily: "AtriumBrand",
              fontSize: hookSize,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              textAlign: align
            }
          },
          ...hookLines.map((text, index) => line(text, index, hookSize))
        ),
        createElement(
          "div",
          {
            style: {
              display: "flex",
              position: "absolute",
              flexDirection: "column",
              left: subtitleLeft,
              top: layout.subtitleY - subtitleSize * 0.82,
              width: layout.subtitleWidth,
              color: "white",
              fontFamily: "AtriumBrand",
              fontSize: subtitleSize,
              fontWeight: 400,
              lineHeight: 1.28,
              textAlign: align
            }
          },
          ...subtitleLines.map((text, index) => line(text, index, subtitleSize))
        )
      ),
      {
        width: 1080,
        height: 1080,
        fonts: [
          { name: "AtriumBrand", data: regularData, weight: 400, style: "normal" },
          { name: "AtriumBrand", data: boldData, weight: 700, style: "normal" }
        ]
      }
    );
    return Buffer.from(await response.arrayBuffer());
  };

  return render(regularFontData, boldFontData);
}

export async function generateAndStoreSocialVisual({
  merchant,
  postId,
  title,
  caption,
  visualPrompt,
  source,
  styleOverride,
  supabaseClient
}: {
  merchant: MerchantRow;
  postId?: string | null;
  title: string;
  caption: string;
  visualPrompt?: string | null;
  source?: string | null;
  styleOverride?: string | null;
  supabaseClient?: SupabaseClient<Database>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY manquante pour générer l'image IA.");
  }

  const supabase = supabaseClient ?? await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !supabaseClient) {
    throw new Error("Utilisateur non connecté.");
  }

  const brand = await getBrandSettings(merchant, supabaseClient);
  const visualStyle = mapVisualStyleToPrompt(styleOverride ?? brand?.visual_style ?? "premium");
  const toneDirection = mapToneToVisualDirection(brand?.tone ?? "professionnel");
  const fontDirection = brand?.social_font_family ? `Police éditoriale de référence pour la future composition : ${brand.social_font_family}.` : "";
  const clientRequest = [source, visualPrompt, title].filter(Boolean).join(" · ");
  const creativeDirection = pickCreativeDirection(clientRequest);
  const posterDirection = "Traite l’image comme une affiche photographique ou illustrée haut de gamme : idée visuelle forte, mise en scène créative, cadrage assumé et détails mémorables, tout en restant crédible pour ce commerce.";
  const prompt = [
    `Crée une image carrée premium pour un post Instagram d'un commerce local.`,
    clientRequest ? `DEMANDE ORIGINALE DU CLIENT — PRIORITÉ ABSOLUE : ${clientRequest}.` : "",
    "FIDÉLITÉ CLIENT : respecte exactement tous les éléments explicitement demandés — personnes, apparence, nombre, posture, action, objets, produits, lieux, cadre, époque, couleurs et détails. Ne remplace, ne retire et ne transpose jamais un élément précis de la demande.",
    `Secteur : ${merchant.business_type}. Ville : ${merchant.city}.`,
    merchant.description ? `Direction artistique et contexte du commerce : ${merchant.description}.` : "",
    `Style visuel attendu : ${visualStyle}.`,
    `Ton de marque à faire ressentir visuellement : ${toneDirection}.`,
    posterDirection,
    `Palette de marque : primaire ${brand?.primary_color ?? "#4C1D95"}, secondaire ${brand?.secondary_color ?? "#F3E8FF"}, accent ${brand?.accent_color ?? "#A855F7"}.`,
    fontDirection,
    source ? `Intention/source marketing : ${source}.` : "",
    `Titre du post : ${title}.`,
    `Description du post : ${caption}.`,
    visualPrompt ? `Recommandation visuelle : ${visualPrompt}.` : "",
    `Piste créative de cette génération : ${creativeDirection}. Utilise-la comme langage visuel secondaire sans contredire la demande originale.`,
    "Compose une scène forte avec une hiérarchie immédiatement compréhensible, mais varie franchement le cadrage, le point de vue, la profondeur, le rythme et la mise en scène d'une génération à l'autre.",
    "Préserve une zone suffisamment lisible pour la future accroche, sans imposer systématiquement la moitié basse ni centrer systématiquement le sujet.",
    "Si la demande originale mentionne une personne, un visage, une main, une équipe, une silhouette ou une foule, représente-la fidèlement. Si Hans conçoit seul le sujet sans demande humaine explicite, une présence humaine naturelle reste autorisée lorsqu'elle rend la scène plus crédible, mais elle ne doit pas détourner l'attention du commerce.",
    "Très important : n'écris jamais le nom de l'enseigne, aucun logo lisible et aucun texte marketing dans l'image, sauf si tu représentes visuellement la façade ou l'intérieur réel de la boutique. Même dans ce cas, cela doit rester rare.",
    "Évite les collages génériques, badges, pictogrammes et détails décoratifs gratuits. Une composition complexe reste autorisée uniquement si le client la demande ou si elle sert clairement le concept.",
    "Important : évite le texte intégré dans l'image générée. Le texte social sera posé ensuite dans le design.",
    "L'image doit être cohérente avec l'identité du commerce, lisible sur mobile, esthétique, crédible et directement publiable."
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
      prompt,
      size: "1024x1024"
    })
  });
  const body = (await response.json()) as OpenAIImageBody;
  const base64 = body.data?.[0]?.b64_json;

  if (!response.ok || !base64) {
    throw new Error(body.error?.message ?? "Génération d'image IA impossible.");
  }

  const path = `${user?.id ?? merchant.id}/${postId ?? "social-visual"}/ai-${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("social-visuals")
    .upload(path, Buffer.from(base64, "base64"), {
      contentType: "image/png",
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrl } = supabase.storage.from("social-visuals").getPublicUrl(path);

  await supabase.from("generated_visuals").insert({
    merchant_id: merchant.id,
    social_post_id: postId ?? null,
    source_image_url: null,
    generated_image_url: publicUrl.publicUrl,
    style: styleOverride ?? brand?.visual_style ?? "premium",
    prompt
  });

  return {
    imageUrl: publicUrl.publicUrl,
    style: styleOverride ?? brand?.visual_style ?? "premium",
    prompt
  };
}

function mapVisualStyleToPrompt(value: string) {
  switch (value) {
    case "premium":
      return "réaliste, photo éditoriale haut de gamme, lumière naturelle soignée";
    case "artisanal":
      return "illustration dessinée, chaleureuse, artisanale, expressive, centrée sur les objets";
    case "minimaliste":
      return "illustration de type carte ou affiche minimaliste, lisible et élégante, sans texte";
    case "chaleureux":
      return "peinture numérique chaleureuse, matières douces, ambiance accueillante";
    case "moderne":
      return "visuel contemporain studio, direction artistique moderne et propre, orienté produit";
    case "dynamique":
      return "visuel énergique, contrasté, composition sociale impactante";
    default:
      return "réaliste et premium";
  }
}

function mapToneToVisualDirection(value: string) {
  switch (value) {
    case "simple":
      return "sobre, clair, direct, lisible, sans surcharge";
    case "convivial":
      return "chaleureux, accessible, vivant, accueillant";
    case "haut_de_gamme":
      return "élégant, raffiné, éditorial, avec sensation de qualité";
    case "professionnel":
    default:
      return "soigné, crédible, structuré, premium sans excès";
  }
}

function limitOverlaySubtitle(value: string) {
  const normalized = value.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "").replace(/\s+/g, " ").trim();
  const completeSentence = normalized.match(/^.*?[.!?](?=\s|$)/)?.[0]?.trim();
  return completeSentence || (/[.!?]$/.test(normalized) ? normalized : `${normalized}.`);
}

function sanitizeOverlayText(value: string) {
  return value
    .normalize("NFC")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u200D\uFE0E\uFE0F]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getOverlayLayout(variant: number, hookLineCount: number) {
  const gradients = {
    top: `<linearGradient id="shade" x1="0" y1="1" x2="0" y2="0"><stop offset="48%" stop-color="#120E1C" stop-opacity="0"/><stop offset="100%" stop-color="#120E1C" stop-opacity="0.76"/></linearGradient>`,
    side: `<linearGradient id="shade" x1="1" y1="0" x2="0" y2="0"><stop offset="42%" stop-color="#120E1C" stop-opacity="0"/><stop offset="100%" stop-color="#120E1C" stop-opacity="0.82"/></linearGradient>`,
    bottom: `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="46%" stop-color="#120E1C" stop-opacity="0"/><stop offset="100%" stop-color="#120E1C" stop-opacity="0.78"/></linearGradient>`
  };

  if (variant === 1) {
    return { hookX: 80, hookWidth: 920, firstLineY: hookLineCount > 1 ? 140 : 210, subtitleX: 80, subtitleY: 338, subtitleWidth: 900, accentX: 80, accentY: 294, signatureX: 80, signatureWidth: 900, anchor: "start", hookSize: 76, gradient: gradients.top };
  }
  if (variant === 2) {
    return { hookX: 72, hookWidth: 500, firstLineY: hookLineCount > 1 ? 270 : 350, subtitleX: 72, subtitleY: 520, subtitleWidth: 500, accentX: 72, accentY: 480, signatureX: 72, signatureWidth: 900, anchor: "start", hookSize: 68, gradient: gradients.side };
  }
  if (variant === 3) {
    return { hookX: 540, hookWidth: 900, firstLineY: hookLineCount > 1 ? 684 : 754, subtitleX: 540, subtitleY: 858, subtitleWidth: 860, accentX: 482, accentY: 816, signatureX: 540, signatureWidth: 860, anchor: "middle", hookSize: 74, gradient: gradients.bottom };
  }
  return { hookX: 84, hookWidth: 912, firstLineY: hookLineCount > 1 ? 684 : 754, subtitleX: 88, subtitleY: 858, subtitleWidth: 880, accentX: 88, accentY: 816, signatureX: 88, signatureWidth: 880, anchor: "start", hookSize: 76, gradient: gradients.bottom };
}


function pickCreativeDirection(seed: string) {
  const directions = [
    "cadrage macro tactile avec profondeur de champ très courte et détails de matière",
    "vue éditoriale en plongée, composition asymétrique et ombres graphiques",
    "plan large cinématographique où le décor raconte autant que le sujet",
    "perspective basse et dynamique avec premier plan audacieux",
    "mise en scène conceptuelle légèrement surréaliste mais crédible",
    "jeu architectural de lignes, reflets et espaces négatifs inattendus",
    "instant pris sur le vif avec mouvement suggéré et lumière spontanée",
    "nature morte contemporaine décentrée, couleurs franches et équilibre imparfait maîtrisé",
    "ambiance nocturne élégante avec éclairage ponctuel et contrastes profonds",
    "composition monochrome texturée relevée par un seul accent coloré"
  ];
  const index = Math.abs(hashText(`${seed}|${Date.now()}|${Math.random()}`)) % directions.length;
  return directions[index];
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
