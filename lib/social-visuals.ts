import sharp from "sharp";
import { getBrandSettings } from "@/lib/brand-settings";
import { fitEstimatedText } from "@/lib/social-editor/layout-safety";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MerchantRow } from "@/lib/supabase/types";

type OpenAIImageBody = {
  data?: { b64_json?: string }[];
  error?: { message?: string };
};

export async function composeAndStoreSocialPostVisual({
  merchant,
  imageUrl,
  visualHook,
  subtitle,
  postId
}: {
  merchant: MerchantRow;
  imageUrl: string;
  visualHook: string;
  subtitle?: string | null;
  postId?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utilisateur non connecté.");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Le visuel source est inaccessible pour la composition.");
  }

  const brand = await getBrandSettings(merchant);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const background = brand?.secondary_color ?? "#F3E8FF";
  const primary = brand?.primary_color ?? "#4C1D95";
  const accent = brand?.accent_color ?? "#A855F7";
  const selectedFont = brand?.social_font_family ?? "Sora";
  const showLogo = Boolean(brand?.show_logo_on_social_posts && merchant.logo_url);
  const logoPosition = brand?.social_logo_position ?? "top_left";
  const logoAtBottom = logoPosition.startsWith("bottom");
  const logoOnRight = logoPosition.endsWith("right");
  const subtitleText = limitOverlaySubtitle(subtitle ?? "");
  const signature = [merchant.business_name, merchant.city].filter(Boolean).join(" · ");
  const rawVariant = Math.abs(hashText(`${visualHook}|${subtitleText}|${signature}`)) % 4;
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
    text: visualHook.replace(/\s+/g, " ").trim(),
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
  const signatureFit = fitEstimatedText({
    text: signature,
    maxWidth: initialLayout.signatureWidth,
    maxHeight: 30,
    maxLines: 1,
    maxFontSize: 22,
    minFontSize: 16,
    lineHeight: 1.1,
    fontWeight: 700
  });

  if (!hookFit || !subtitleFit || !signatureFit) {
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
  const hookMarkup = hookFit.lines
    .map((line, index) => `<tspan x="${layout.hookX}" y="${layout.firstLineY + index * hookFit.fontSize * 1.08}">${escapeXml(line)}</tspan>`)
    .join("");
  const subtitleMarkup = subtitleFit.lines
    .map((line, index) => `<tspan x="${layout.subtitleX}" y="${layout.subtitleY + index * subtitleFit.fontSize * 1.28}">${escapeXml(line)}</tspan>`)
    .join("");
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
      <text text-anchor="${layout.anchor}" font-family="${escapeXml(selectedFont)}, Arial, Helvetica, sans-serif" font-size="${hookFit.fontSize}" font-weight="800" fill="#FFFFFF" letter-spacing="-1.5" paint-order="stroke" stroke="${escapeXml(primary)}" stroke-opacity="0.28" stroke-width="3">${hookMarkup}</text>
      <rect x="${layout.accentX}" y="${layout.accentY}" width="116" height="6" rx="3" fill="${escapeXml(accent)}"/>
      <text text-anchor="${layout.anchor}" font-family="${escapeXml(selectedFont)}, Arial, Helvetica, sans-serif" font-size="${subtitleFit.fontSize}" font-weight="500" fill="#FFFFFF">${subtitleMarkup}</text>
      <text x="${layout.signatureX}" y="1014" text-anchor="${layout.anchor}" font-family="${escapeXml(selectedFont)}, Arial, Helvetica, sans-serif" font-size="${signatureFit.fontSize}" font-weight="700" fill="#FFFFFF">${escapeXml(signature)}</text>
    </svg>
  `);
  const composites: { input: Buffer; top: number; left: number }[] = [{ input: overlay, top: 0, left: 0 }];

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
  const path = `${user.id}/${postId ?? "social-ready"}/ready-${Date.now()}.png`;
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

export async function generateAndStoreSocialVisual({
  merchant,
  postId,
  title,
  caption,
  visualPrompt,
  source,
  styleOverride
}: {
  merchant: MerchantRow;
  postId?: string | null;
  title: string;
  caption: string;
  visualPrompt?: string | null;
  source?: string | null;
  styleOverride?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY manquante pour générer l'image IA.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utilisateur non connecté.");
  }

  const brand = await getBrandSettings(merchant);
  const visualStyle = mapVisualStyleToPrompt(styleOverride ?? brand?.visual_style ?? "premium");
  const toneDirection = mapToneToVisualDirection(brand?.tone ?? "professionnel");
  const fontDirection = brand?.social_font_family ? `Police éditoriale de référence pour la future composition : ${brand.social_font_family}.` : "";
  const clientRequest = [source, visualPrompt, title].filter(Boolean).join(" · ");
  const peopleExplicitlyRequested = hasExplicitPeopleRequest(clientRequest);
  const creativeDirection = pickCreativeDirection(clientRequest);
  const prompt = [
    `Crée une image carrée premium pour un post Instagram d'un commerce local.`,
    clientRequest ? `DEMANDE ORIGINALE DU CLIENT — PRIORITÉ ABSOLUE : ${clientRequest}.` : "",
    "Respecte littéralement les sujets, personnes, objets, actions, lieux, cadres, époques, couleurs et détails explicitement demandés. Ne remplace jamais un élément précis par une image générique du secteur.",
    `Secteur : ${merchant.business_type}. Ville : ${merchant.city}.`,
    merchant.description ? `Direction artistique et contexte du commerce : ${merchant.description}.` : "",
    `Style visuel attendu : ${visualStyle}.`,
    `Ton de marque à faire ressentir visuellement : ${toneDirection}.`,
    `Palette de marque : primaire ${brand?.primary_color ?? "#4C1D95"}, secondaire ${brand?.secondary_color ?? "#F3E8FF"}, accent ${brand?.accent_color ?? "#A855F7"}.`,
    fontDirection,
    source ? `Intention/source marketing : ${source}.` : "",
    `Titre du post : ${title}.`,
    `Description du post : ${caption}.`,
    visualPrompt ? `Recommandation visuelle : ${visualPrompt}.` : "",
    `Piste créative de cette génération : ${creativeDirection}. Utilise-la comme langage visuel secondaire sans contredire la demande originale.`,
    "Compose une scène forte avec une hiérarchie immédiatement compréhensible, mais varie franchement le cadrage, le point de vue, la profondeur, le rythme et la mise en scène d'une génération à l'autre.",
    "Préserve une zone suffisamment lisible pour la future accroche, sans imposer systématiquement la moitié basse ni centrer systématiquement le sujet.",
    peopleExplicitlyRequested
      ? "Le client demande explicitement une présence humaine : représente fidèlement la ou les personnes, leur rôle, leur action, leur apparence et le cadre demandé. Cette demande humaine doit être visible, crédible et centrale."
      : "Interdiction stricte d'ajouter une personne, un visage, une main, une silhouette, un reflet humain ou une foule : aucune présence humaine n'a été explicitement demandée par le client.",
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

  const path = `${user.id}/${postId ?? "social-visual"}/ai-${Date.now()}.png`;
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

function hasExplicitPeopleRequest(value: string) {
  const normalized = value.toLocaleLowerCase("fr-FR").replace(/\s+/g, " ");
  const humanSubject = "(?:personne|femme|homme|couple|mari[ée]e?|enfant|famille|client[e]?|équipe|artisan[e]?|serveu(?:r|se)|coiffeu(?:r|se)|modèle|mannequin|portrait)";
  return new RegExp(`(?:avec|montr(?:e|er|ant)|représent(?:e|er|ant)|génèr(?:e|er)|cré(?:e|er)|inclu(?:re|ant)|photo de|portrait de).{0,80}\\b${humanSubject}\\b`, "i").test(normalized)
    || new RegExp(`\\b${humanSubject}\\b.{0,50}(?:dans|devant|en train de|qui)`, "i").test(normalized);
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
