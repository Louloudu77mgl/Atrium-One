import type { MerchantBrandSettingsRow, MerchantMediaAssetRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";
import { createInitialBuilderState, parseBuilderState, type ImageLayer, type SocialBuilderState, type SocialLayer, type TextLayer } from "@/lib/social-builder";
import { isEditorDocument, type DesignElement, type EditorFormat, type ImageDesignElement, type InstagramDesignDocument, type ShapeDesignElement, type TextDesignElement } from "./types";

export const FORMAT_DIMENSIONS: Record<EditorFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "Carré 1080 × 1080" },
  portrait: { width: 1080, height: 1350, label: "Portrait 1080 × 1350" },
  story: { width: 1080, height: 1920, label: "Story 1080 × 1920" }
};

export const DEFAULT_FONTS = [
  "Inter",
  "Arial",
  "Georgia",
  "Trebuchet MS",
  "Helvetica Neue"
] as const;

type TemplateDefinition = {
  id: string;
  title: string;
  description: string;
  category: string;
};

export const TEMPLATE_LIBRARY: TemplateDefinition[] = [
  { id: "promotion", title: "Promotion", description: "Mettre en avant une offre ou une remise.", category: "promotion" },
  { id: "new", title: "Nouveauté", description: "Présenter un nouveau produit ou service.", category: "nouveauté" },
  { id: "testimonial", title: "Témoignage client", description: "Valoriser un retour client marquant.", category: "témoignage" },
  { id: "tip", title: "Conseil", description: "Partager une astuce simple et utile.", category: "conseil" },
  { id: "before-after", title: "Avant / après", description: "Montrer une transformation ou un résultat.", category: "avant/après" },
  { id: "event", title: "Événement", description: "Annoncer une date importante.", category: "événement" },
  { id: "quote", title: "Citation", description: "Mettre une phrase forte au centre du visuel.", category: "citation" },
  { id: "product", title: "Produit vedette", description: "Créer un focus sur un produit phare.", category: "produit" }
];

let elementIdCounter = 0;

export function createElementId(prefix: "text" | "shape" | "image" | "logo") {
  elementIdCounter += 1;
  const uniquePart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${elementIdCounter}`;
  return `${prefix}-${uniquePart}`;
}

export function createEditorDocument({
  post,
  merchant,
  brandSettings,
  galleryAssets
}: {
  post: SocialPostRow;
  merchant?: MerchantRow | null;
  brandSettings?: MerchantBrandSettingsRow | null;
  galleryAssets?: MerchantMediaAssetRow[];
}): InstagramDesignDocument {
  if (isEditorDocument(post.builder_state)) {
    return normalizeDocument({
      ...post.builder_state,
      postTitle: post.title,
      caption: post.caption,
      hashtags: post.hashtags.join(" ")
    });
  }

  const fallbackBuilder = createInitialBuilderState({
    post,
    merchant,
    brand: brandSettings,
    imageUrl: post.image_url ?? post.visual_url ?? galleryAssets?.[0]?.url ?? null,
    includeVisualText: true
  });
  const builderState = parseBuilderState(post.builder_state, fallbackBuilder);

  return {
    version: 2,
    format: detectFormat(builderState),
    postTitle: post.title,
    caption: post.caption,
    hashtags: post.hashtags.join(" "),
    altText: "",
    backgroundColor: builderState.canvas.background,
    backgroundImage: null,
    safetyMargin: true,
    elements: builderState.layers.map((layer) => mapBuilderLayerToElement(layer))
  };
}

export function createGeneratedDesignDocument({
  title,
  caption,
  visualHook,
  visualSubtitle,
  imageUrl,
  merchant,
  brandSettings
}: {
  title: string;
  caption: string;
  visualHook?: string | null;
  visualSubtitle?: string | null;
  imageUrl?: string | null;
  merchant?: MerchantRow | null;
  brandSettings?: MerchantBrandSettingsRow | null;
}): InstagramDesignDocument {
  const primary = brandSettings?.primary_color ?? "#4C1D95";
  const secondary = brandSettings?.secondary_color ?? "#F3E8FF";
  const accent = brandSettings?.accent_color ?? "#A855F7";
  const preferredFont = brandSettings?.social_font_family ?? "Sora";
  const businessName = merchant?.business_name?.trim() || "Votre commerce";
  const showLogo = Boolean(brandSettings?.show_logo_on_social_posts && merchant?.logo_url);
  const logoPosition = brandSettings?.social_logo_position ?? "top_left";
  const logoAtBottom = logoPosition.startsWith("bottom");
  const logoOnRight = logoPosition.endsWith("right");
  const hook = limitVisualText(visualHook?.trim() || title.trim(), 6, 40);
  const subtitle = limitVisualSubtitle(visualSubtitle?.trim() || caption, 96);
  const signature = [businessName, merchant?.city].filter(Boolean).join(" · ");
  const rawVariant = Math.abs(hashString(`${hook}|${subtitle}|${businessName}`)) % 4;
  const variant = showLogo && logoAtBottom && (rawVariant === 0 || rawVariant === 3)
    ? rawVariant === 0 ? 1 : 2
    : showLogo && !logoAtBottom && rawVariant === 1
      ? 3
      : rawVariant;
  const layouts = [
    { x: 84, titleY: 668, titleWidth: 850, lineX: 88, lineY: 862, subtitleX: 88, subtitleY: 888, subtitleWidth: 820, signatureX: 88, signatureY: 994, align: "left" as const },
    { x: 76, titleY: 92, titleWidth: 870, lineX: 80, lineY: 286, subtitleX: 80, subtitleY: 312, subtitleWidth: 840, signatureX: 80, signatureY: 992, align: "left" as const },
    { x: 68, titleY: 214, titleWidth: 460, lineX: 72, lineY: 416, subtitleX: 72, subtitleY: 444, subtitleWidth: 430, signatureX: 72, signatureY: 984, align: "left" as const },
    { x: 116, titleY: 650, titleWidth: 848, lineX: 482, lineY: 844, subtitleX: 130, subtitleY: 874, subtitleWidth: 820, signatureX: 180, signatureY: 992, align: "center" as const }
  ];
  const baseLayout = layouts[variant];
  const layout = showLogo && logoAtBottom
    ? {
        ...baseLayout,
        signatureX: logoOnRight ? 80 : 200,
        signatureY: 994,
        align: "left" as const
      }
    : baseLayout;
  const document: InstagramDesignDocument = {
    version: 2,
    format: "square",
    postTitle: title,
    caption,
    hashtags: "",
    altText: caption.trim().slice(0, 160),
    backgroundColor: secondary,
    backgroundImage: null,
    safetyMargin: true,
    elements: []
  };

  if (imageUrl) {
    document.elements.push({
      ...createImageElement(imageUrl, 1080, 1080, "Visuel principal"),
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      borderRadius: 0,
      cropX: 50,
      cropY: 50,
      fit: "contain",
      scale: 1,
      shadow: false,
      zIndex: 0
    });
    document.elements.push({
      ...createImageElement(createVignetteOverlayDataUrl(variant), 1080, 1080, "Vignettage"),
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      borderRadius: 0,
      cropX: 50,
      cropY: 50,
      fit: "cover",
      scale: 1,
      shadow: false,
      zIndex: 1
    });
  } else {
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, primary),
      name: "Fond principal",
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      borderRadius: 0,
      fill: primary,
      borderColor: primary,
      borderWidth: 0,
      zIndex: 0
    });
  }

  document.elements.push({
    ...createTextElement("title", 1080, 1080),
    name: "Accroche",
    text: hook,
    x: layout.x,
    y: layout.titleY,
    width: layout.titleWidth,
    height: 176,
    fontSize: hook.length > 28 ? 68 : 78,
    fontWeight: 800,
    color: "#FFFFFF",
    fontFamily: preferredFont,
    align: layout.align,
    lineHeight: 1.04,
    zIndex: 2
  });
  document.elements.push({
    ...createShapeElement("line", 1080, 1080, accent),
    name: "Tiret d’accent",
    x: layout.lineX,
    y: layout.lineY,
    width: 116,
    height: 6,
    borderRadius: 999,
    fill: accent,
    borderColor: accent,
    borderWidth: 0,
    zIndex: 3
  });
  document.elements.push({
    ...createTextElement("body", 1080, 1080),
    name: "Sous-titre",
    text: subtitle,
    x: layout.subtitleX,
    y: layout.subtitleY,
    width: layout.subtitleWidth,
    height: 98,
    fontSize: subtitle.length > 72 ? 27 : 30,
    fontWeight: 500,
    color: "#FFFFFF",
    fontFamily: preferredFont,
    align: layout.align,
    lineHeight: 1.2,
    zIndex: 4
  });
  document.elements.push({
    ...createTextElement("small", 1080, 1080),
    name: "Signature",
    text: signature,
    x: layout.signatureX,
    y: layout.signatureY,
    width: 720,
    height: 38,
    fontSize: 22,
    fontWeight: 700,
    color: "#FFFFFF",
    fontFamily: preferredFont,
    align: layout.align,
    zIndex: 5
  });

  if (showLogo && merchant?.logo_url) {
    const logoX = logoOnRight ? 904 : 64;
    const logoY = logoAtBottom ? 904 : 64;
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, "rgba(255,255,255,0.92)"),
      name: "Fond du logo",
      x: logoX,
      y: logoY,
      width: 112,
      height: 112,
      borderRadius: 22,
      fill: "rgba(255,255,255,0.92)",
      borderColor: withOpacity(accent, 0.28),
      borderWidth: 2,
      shadow: true,
      zIndex: 6
    });
    document.elements.push({
      ...createImageElement(merchant.logo_url, 88, 88, "Logo du commerce"),
      type: "logo",
      x: logoX + 12,
      y: logoY + 12,
      width: 88,
      height: 88,
      fit: "contain",
      borderRadius: 12,
      shadow: false,
      zIndex: 7
    });
  }

  return normalizeDocument(document);
}

function limitVisualSubtitle(value: string, _maxCharacters: number) {
  const normalized = value.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "").replace(/\s+/g, " ").trim();
  const completeSentence = normalized.match(/^.*?[.!?](?=\s|$)/)?.[0]?.trim();
  return completeSentence || (/[.!?]$/.test(normalized) ? normalized : `${normalized}.`);
}

function createVignetteOverlayDataUrl(variant: number) {
  const directionalGradient = variant === 1
    ? `<linearGradient id="direction" x1="0" y1="1" x2="0" y2="0"><stop offset="52%" stop-color="#120E1C" stop-opacity="0"/><stop offset="100%" stop-color="#120E1C" stop-opacity="0.72"/></linearGradient>`
    : variant === 2
      ? `<linearGradient id="direction" x1="1" y1="0" x2="0" y2="0"><stop offset="44%" stop-color="#120E1C" stop-opacity="0"/><stop offset="100%" stop-color="#120E1C" stop-opacity="0.78"/></linearGradient>`
      : `<linearGradient id="direction" x1="0" y1="0" x2="0" y2="1"><stop offset="48%" stop-color="#120E1C" stop-opacity="0"/><stop offset="100%" stop-color="#120E1C" stop-opacity="${variant === 3 ? "0.78" : "0.68"}"/></linearGradient>`;
  const svg = `
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="vignette" cx="50%" cy="42%" r="72%">
          <stop offset="50%" stop-color="#120E1C" stop-opacity="0"/>
          <stop offset="100%" stop-color="#120E1C" stop-opacity="0.42"/>
        </radialGradient>
        ${directionalGradient}
      </defs>
      <rect width="1080" height="1080" fill="url(#vignette)"/>
      <rect width="1080" height="1080" fill="url(#direction)"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function limitVisualText(value: string, maxWords: number, maxCharacters: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, maxWords);
  const shortened = words.join(" ");

  if (shortened.length <= maxCharacters) {
    return shortened;
  }

  const clipped = shortened.slice(0, maxCharacters + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > maxCharacters * 0.6 ? lastSpace : maxCharacters).trim()}…`;
}

function createLegacyGeneratedDesignDocument({
  title,
  caption,
  visualHook,
  imageUrl,
  merchant,
  brandSettings
}: {
  title: string;
  caption: string;
  visualHook?: string | null;
  imageUrl?: string | null;
  merchant?: MerchantRow | null;
  brandSettings?: MerchantBrandSettingsRow | null;
}): InstagramDesignDocument {
  const primary = brandSettings?.primary_color ?? "#4C1D95";
  const secondary = brandSettings?.secondary_color ?? "#F3E8FF";
  const accent = brandSettings?.accent_color ?? "#A855F7";
  const preferredFont = brandSettings?.social_font_family ?? "Sora";
  const brandTone = brandSettings?.tone ?? "professionnel";
  const visualStyle = brandSettings?.visual_style ?? "premium";
  const businessName = merchant?.business_name ?? "Votre commerce";
  const shortCaption = caption.trim().slice(0, 172);
  const hook = (visualHook?.trim() || title.trim()).slice(0, 64);
  const variant = Math.abs(hashString(`${title}|${caption}|${businessName}`)) % 3;
  const stylePack = getStylePack(brandTone, visualStyle);
  const sticker = pickSticker(title, caption, brandTone, visualStyle);
  const supportFont = preferredFont === "Sora" ? "Inter" : preferredFont;
  const primaryText = getReadableTextColor(primary);
  const accentText = getReadableTextColor(accent);
  const darkText = "#211432";
  const mutedText = brandTone === "haut_de_gamme" ? "#5F5870" : "#6B617F";
  const kicker = getKickerText(merchant?.business_type, brandTone);
  const footerLine = getFooterLine(brandTone, businessName);

  const document: InstagramDesignDocument = {
    version: 2,
    format: "square",
    postTitle: title,
    caption,
    hashtags: "",
    altText: shortCaption,
    backgroundColor: secondary,
    backgroundImage: null,
    safetyMargin: true,
    elements: []
  };

  if (imageUrl) {
    document.elements.push({
      ...createImageElement(imageUrl, 1080, 1080, "Photo de fond"),
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      borderRadius: 0,
      cropX: 50,
      cropY: 50,
      scale: 1.18,
      shadow: false,
      zIndex: 0
    });
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, "rgba(20,14,33,0.28)"),
      name: "Voile photo",
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      borderRadius: 0,
      fill: "rgba(20,14,33,0.28)",
      borderColor: "rgba(20,14,33,0.28)",
      borderWidth: 0,
      zIndex: 1
    });
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, withOpacity(primary, 0.22)),
      name: "Voile charte",
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      borderRadius: 0,
      fill: withOpacity(primary, 0.22),
      borderColor: withOpacity(primary, 0.22),
      borderWidth: 0,
      opacity: 0.72,
      zIndex: 2
    });
  } else {
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, secondary),
      name: "Fond principal",
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      borderRadius: 0,
      borderWidth: 0,
      fill: secondary,
      zIndex: 0
    });
  }

  if (variant === 0) {
    document.elements.push({
      ...createShapeElement("circle", 1080, 1080, accent),
      name: "Halo accent",
      x: 722,
      y: 46,
      width: 220,
      height: 220,
      opacity: 0.2,
      zIndex: 3
    });
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, "#FFFFFF"),
      name: "Carte titre",
      x: 64,
      y: 88,
      width: 438,
      height: 440,
      borderRadius: 40,
      shadow: true,
      borderWidth: 0,
      opacity: 0.97,
      zIndex: 4
    });

    if (imageUrl) {
      document.elements.push({
        ...createImageElement(imageUrl, 1080, 1080, "Photo collage"),
        x: 560,
        y: 98,
        width: 416,
        height: 610,
        borderRadius: 42,
        cropX: 52,
        cropY: 50,
        scale: 1.22,
        shadow: true,
        rotation: -5,
        zIndex: 5
      });
      document.elements.push({
        ...createImageElement(imageUrl, 1080, 1080, "Photo secondaire"),
        x: 716,
        y: 592,
        width: 218,
        height: 218,
        borderRadius: 30,
        cropX: 46,
        cropY: 52,
        scale: 1.28,
        rotation: 8,
        shadow: true,
        zIndex: 6
      });
    }
  } else if (variant === 1) {
    document.elements.push({
      ...createShapeElement("circle", 1080, 1080, withOpacity(accent, 0.16)),
      name: "Halo haut",
      x: 82,
      y: 52,
      width: 240,
      height: 240,
      fill: withOpacity(accent, 0.16),
      borderColor: withOpacity(accent, 0.16),
      borderWidth: 0,
      zIndex: 3
    });
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, "#FFFFFF"),
      name: "Bloc info",
      x: 84,
      y: 700,
      width: 912,
      height: 236,
      borderRadius: 34,
      shadow: true,
      borderWidth: 0,
      opacity: 0.97,
      zIndex: 4
    });

    if (imageUrl) {
      document.elements.push({
        ...createImageElement(imageUrl, 1080, 1080, "Photo bandeau"),
        x: 118,
        y: 88,
        width: 848,
        height: 526,
        borderRadius: 42,
        cropX: 50,
        cropY: 46,
        scale: 1.18,
        shadow: true,
        zIndex: 5
      });
      document.elements.push({
        ...createImageElement(imageUrl, 1080, 1080, "Photo détail"),
        x: 804,
        y: 622,
        width: 172,
        height: 172,
        borderRadius: 26,
        cropX: 54,
        cropY: 50,
        scale: 1.26,
        rotation: 7,
        shadow: true,
        zIndex: 6
      });
    }
  } else {
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, "#FFFFFF"),
      name: "Panneau gauche",
      x: 54,
      y: 64,
      width: 408,
      height: 560,
      borderRadius: 42,
      shadow: true,
      borderWidth: 0,
      opacity: 0.97,
      zIndex: 3
    });
    document.elements.push({
      ...createShapeElement("rectangle", 1080, 1080, withOpacity(primary, 0.08)),
      name: "Panneau bas",
      x: 54,
      y: 654,
      width: 972,
      height: 236,
      borderRadius: 38,
      fill: withOpacity(primary, 0.08),
      borderColor: withOpacity(primary, 0.08),
      borderWidth: 0,
      zIndex: 4
    });

    if (imageUrl) {
      document.elements.push({
        ...createImageElement(imageUrl, 1080, 1080, "Photo portrait"),
        x: 548,
        y: 82,
        width: 384,
        height: 548,
        borderRadius: 40,
        cropX: 50,
        cropY: 50,
        scale: 1.24,
        shadow: true,
        rotation: -4,
        zIndex: 5
      });
      document.elements.push({
        ...createImageElement(imageUrl, 1080, 1080, "Photo vignette"),
        x: 808,
        y: 660,
        width: 164,
        height: 164,
        borderRadius: 28,
        cropX: 48,
        cropY: 50,
        scale: 1.3,
        rotation: 9,
        shadow: true,
      zIndex: 6
      });
    }
  }

  document.elements.push({
    ...createShapeElement("pill", 1080, 1080, accent),
    name: "Badge thème",
    x: variant === 1 ? 118 : 92,
    y: variant === 1 ? 722 : 112,
    width: 220,
    height: 68,
    borderRadius: 999,
    borderWidth: 0,
    zIndex: 7
  });
  document.elements.push({
    ...createTextElement("small", 1080, 1080),
    name: "Badge texte",
    text: kicker,
    x: variant === 1 ? 144 : 120,
    y: variant === 1 ? 736 : 126,
    width: 172,
    height: 34,
    fontSize: 20,
    fontWeight: 800,
    color: accentText,
    align: "center",
    fontFamily: preferredFont,
    zIndex: 8
  });
  document.elements.push({
    ...createTextElement("small", 1080, 1080),
    name: "Sticker emoji",
    text: sticker,
    x: variant === 1 ? 904 : 894,
    y: variant === 1 ? 72 : 92,
    width: 112,
    height: 72,
    fontSize: stylePack.emojiSize,
    fontWeight: 700,
    color: accent,
    fontFamily: supportFont,
    align: "center",
    zIndex: 8
  });
  document.elements.push({
    ...createTextElement("title", 1080, 1080),
    name: "Titre principal",
    text: stylePack.titlePrefix ? `${stylePack.titlePrefix} ${hook}` : hook,
    x: variant === 1 ? 120 : variant === 2 ? 88 : 92,
    y: variant === 1 ? 798 : variant === 2 ? 184 : 200,
    width: variant === 1 ? 626 : variant === 2 ? 328 : 372,
    height: variant === 1 ? 144 : 212,
    fontSize: variant === 1 ? stylePack.titleSize - 8 : stylePack.titleSize,
    fontWeight: 800,
    color: darkText,
    fontFamily: preferredFont,
    align: "left",
    lineHeight: stylePack.titleLineHeight,
    zIndex: 9
  });
  document.elements.push({
    ...createTextElement("body", 1080, 1080),
    name: "Sous-texte",
    text: injectToneEmoji(shortCaption || "Ajoutez une idée claire, chaleureuse et prête à publier.", stylePack.bodyEmoji),
    x: variant === 1 ? 122 : variant === 2 ? 88 : 96,
    y: variant === 1 ? 916 : variant === 2 ? 414 : 392,
    width: variant === 1 ? 650 : variant === 2 ? 320 : 338,
    height: variant === 1 ? 98 : 142,
    fontSize: variant === 1 ? stylePack.bodySize - 1 : stylePack.bodySize,
    fontWeight: 500,
    color: mutedText,
    fontFamily: supportFont,
    align: "left",
    lineHeight: stylePack.bodyLineHeight,
    zIndex: 9
  });
  document.elements.push({
    ...createShapeElement("line", 1080, 1080, withOpacity(primary, 0.24)),
    name: "Ligne décorative",
    x: variant === 1 ? 124 : variant === 2 ? 88 : 96,
    y: variant === 1 ? 694 : variant === 2 ? 386 : 360,
    width: variant === 1 ? 184 : 124,
    height: 8,
    fill: withOpacity(primary, 0.24),
    borderColor: withOpacity(primary, 0.24),
    borderWidth: 0,
    zIndex: 8
  });
  document.elements.push({
    ...createShapeElement("band", 1080, 1080, primary),
    name: "Bandeau bas",
    x: 0,
    y: 934,
    width: 1080,
    height: 146,
    borderRadius: 0,
    borderWidth: 0,
    zIndex: 10
  });
  document.elements.push({
    ...createTextElement("small", 1080, 1080),
    name: "Signature commerce",
    text: businessName,
    x: 84,
    y: 968,
    width: 580,
    height: 42,
    fontSize: 28,
    fontWeight: 800,
    color: primaryText,
    fontFamily: preferredFont,
    align: "left",
    zIndex: 11
  });
  document.elements.push({
    ...createTextElement("small", 1080, 1080),
    name: "Invitation",
    text: footerLine,
    x: 84,
    y: 1002,
    width: 620,
    height: 34,
    fontSize: 20,
    fontWeight: 600,
    color: primaryText === "#FFFFFF" ? "#E9D5FF" : withOpacity(primaryText, 0.82),
    fontFamily: supportFont,
    align: "left",
    zIndex: 11
  });

  return normalizeDocument(document);
}

export function normalizeDocument(document: InstagramDesignDocument): InstagramDesignDocument {
  return {
    ...document,
    elements: document.elements
      .map((element, index) => ({
        ...element,
        zIndex: index + 1,
        visible: element.visible !== false,
        locked: element.locked === true,
        opacity: clamp(element.opacity, 0, 1)
      }))
      .sort((left, right) => left.zIndex - right.zIndex)
  };
}

export function serializeDocumentToBuilderState(document: InstagramDesignDocument): SocialBuilderState {
  const size = FORMAT_DIMENSIONS[document.format];
  return {
    version: 1,
    canvas: {
      width: size.width,
      height: size.height,
      background: document.backgroundColor
    },
    layers: document.elements
      .filter((element) => element.visible)
      .map((element) => mapElementToBuilderLayer(element))
      .sort((left, right) => left.zIndex - right.zIndex)
  };
}

export function createTextElement(kind: "title" | "subtitle" | "body" | "small", canvasWidth: number, canvasHeight: number): TextDesignElement {
  const presets = {
    title: { name: "Titre", text: "Ajoutez votre titre", fontSize: 84, width: 760, height: 140, fontWeight: 800 },
    subtitle: { name: "Sous-titre", text: "Sous-titre", fontSize: 54, width: 720, height: 110, fontWeight: 700 },
    body: { name: "Texte", text: "Votre texte", fontSize: 36, width: 680, height: 160, fontWeight: 500 },
    small: { name: "Texte secondaire", text: "Texte secondaire", fontSize: 24, width: 520, height: 90, fontWeight: 500 }
  }[kind];

  return {
    id: createElementId("text"),
    type: "text",
    name: presets.name,
    x: Math.round((canvasWidth - presets.width) / 2),
    y: Math.round((canvasHeight - presets.height) / 2),
    width: presets.width,
    height: presets.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 99,
    text: presets.text,
    fontFamily: "Inter",
    fontSize: presets.fontSize,
    fontWeight: presets.fontWeight,
    fontStyle: "normal",
    underline: false,
    align: "center",
    color: "#FFFFFF",
    backgroundColor: null,
    lineHeight: 1.1,
    letterSpacing: 0
  };
}

export function createShapeElement(shape: ShapeDesignElement["shape"], canvasWidth: number, canvasHeight: number, color: string): ShapeDesignElement {
  const defaults = {
    rectangle: { width: 420, height: 220, borderRadius: 24 },
    circle: { width: 220, height: 220, borderRadius: 999 },
    line: { width: 420, height: 8, borderRadius: 999 },
    band: { width: canvasWidth - 120, height: 120, borderRadius: 20 },
    frame: { width: canvasWidth - 160, height: canvasHeight - 160, borderRadius: 28 },
    pill: { width: 420, height: 96, borderRadius: 999 },
    divider: { width: 560, height: 4, borderRadius: 999 }
  }[shape];

  return {
    id: createElementId("shape"),
    type: "shape",
    name: shapeLabel(shape),
    shape,
    x: Math.round((canvasWidth - defaults.width) / 2),
    y: Math.round((canvasHeight - defaults.height) / 2),
    width: defaults.width,
    height: defaults.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 99,
    fill: shape === "frame" ? "transparent" : color,
    borderColor: color,
    borderWidth: shape === "frame" ? 8 : shape === "line" || shape === "divider" ? 0 : 2,
    borderRadius: defaults.borderRadius,
    shadow: false
  };
}

export function createImageElement(src: string, canvasWidth: number, canvasHeight: number, name = "Image"): ImageDesignElement {
  const size = Math.min(canvasWidth, canvasHeight) * 0.64;
  return {
    id: createElementId("image"),
    type: "image",
    name,
    x: Math.round((canvasWidth - size) / 2),
    y: Math.round((canvasHeight - size) / 2),
    width: Math.round(size),
    height: Math.round(size),
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 99,
    src,
    fit: "cover",
    cropX: 50,
    cropY: 50,
    scale: 1,
    borderRadius: 28,
    shadow: false
  };
}

export function applyTemplate(document: InstagramDesignDocument, templateId: string, merchant?: MerchantRow | null): InstagramDesignDocument {
  const accent = findPrimaryColor(document);
  const primaryImage = document.elements.find((element) => (element.type === "image" || element.type === "logo") && element.visible) as ImageDesignElement | undefined;
  const title = document.elements.find((element) => element.type === "text") as TextDesignElement | undefined;
  const canvas = FORMAT_DIMENSIONS[document.format];

  const next = structuredClone(document) as InstagramDesignDocument;
  next.elements = [];

  if (primaryImage?.src) {
    next.elements.push({
      ...createImageElement(primaryImage.src, canvas.width, canvas.height, primaryImage.name),
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      zIndex: 1
    });
  }

  if (templateId === "promotion") {
    next.elements.push({
      ...createShapeElement("band", canvas.width, canvas.height, "rgba(33,20,50,0.58)"),
      y: canvas.height - 220,
      height: 180,
      zIndex: 2,
      fill: "rgba(33,20,50,0.58)",
      borderColor: "rgba(33,20,50,0)"
    });
    next.elements.push({
      ...createTextElement("title", canvas.width, canvas.height),
      text: title?.text || next.postTitle,
      y: canvas.height - 210,
      x: 80,
      width: canvas.width - 160,
      height: 120,
      align: "left",
      zIndex: 3
    });
  } else if (templateId === "quote") {
    next.elements.push({
      ...createShapeElement("rectangle", canvas.width, canvas.height, "rgba(255,255,255,0.85)"),
      width: canvas.width - 140,
      height: canvas.height - 220,
      x: 70,
      y: 110,
      fill: "rgba(255,255,255,0.82)",
      borderColor: accent,
      borderWidth: 3,
      zIndex: 2
    });
    next.elements.push({
      ...createTextElement("title", canvas.width, canvas.height),
      text: title?.text || next.postTitle,
      color: "#211432",
      width: canvas.width - 220,
      x: 110,
      y: 220,
      zIndex: 3
    });
  } else {
    next.elements.push({
      ...createShapeElement("frame", canvas.width, canvas.height, accent),
      x: 40,
      y: 40,
      width: canvas.width - 80,
      height: canvas.height - 80,
      zIndex: 2
    });
    next.elements.push({
      ...createTextElement("title", canvas.width, canvas.height),
      text: title?.text || next.postTitle,
      y: 90,
      color: "#FFFFFF",
      zIndex: 3
    });
  }

  if (merchant?.business_name) {
    next.elements.push({
      ...createTextElement("small", canvas.width, canvas.height),
      name: "Signature",
      text: merchant.business_name,
      y: canvas.height - 110,
      x: 72,
      width: canvas.width - 144,
      height: 48,
      fontSize: 28,
      align: "left",
      color: "#FFFFFF",
      zIndex: 4
    });
  }

  next.elements = normalizeDocument(next).elements;
  return next;
}

export function formatHashtags(value: string) {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .join(" ");
}

function detectFormat(builderState: SocialBuilderState): EditorFormat {
  if (builderState.canvas.width === 1080 && builderState.canvas.height === 1350) {
    return "portrait";
  }
  if (builderState.canvas.width === 1080 && builderState.canvas.height === 1920) {
    return "story";
  }
  return "square";
}

function mapBuilderLayerToElement(layer: SocialLayer): DesignElement {
  if (layer.kind === "image") {
    return {
      id: layer.id,
      type: layer.id === "logo" ? "logo" : "image",
      name: layer.id === "hero-image" ? "Image principale" : "Image",
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      opacity: 1,
      visible: true,
      locked: Boolean(layer.locked),
      zIndex: layer.zIndex,
      src: layer.src,
      fit: layer.objectFit,
      cropX: layer.objectPositionX,
      cropY: layer.objectPositionY,
      scale: layer.scale,
      borderRadius: layer.id === "hero-image" ? 0 : 28,
      shadow: false
    };
  }

  return {
    id: layer.id,
    type: "text",
    name: mapTextName(layer),
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    opacity: 1,
    visible: true,
    locked: Boolean(layer.locked),
    zIndex: layer.zIndex,
    text: layer.text,
    fontFamily: "Inter",
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    fontStyle: "normal",
    underline: false,
    align: layer.align,
    color: layer.color,
    backgroundColor: layer.background ?? null,
    lineHeight: 1.1,
    letterSpacing: layer.letterSpacing ?? 0
  };
}

function mapElementToBuilderLayer(element: DesignElement): SocialLayer {
  if (element.type === "text") {
    const layer: TextLayer = {
      id: element.id,
      kind: "text",
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      zIndex: element.zIndex,
      locked: element.locked,
      text: element.text,
      color: element.color,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      align: element.align,
      background: element.backgroundColor ?? undefined,
      paddingX: 18,
      paddingY: 12,
      radius: 18,
      letterSpacing: element.letterSpacing,
      textTransform: "none"
    };
    return layer;
  }

  const radius = element.type === "shape" ? element.borderRadius : element.borderRadius;
  const imageLayer: ImageLayer = {
    id: element.id,
    kind: "image",
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    zIndex: element.zIndex,
    locked: element.locked,
    src: element.type === "shape" ? "" : element.src,
    objectFit: element.type === "shape" ? "cover" : element.fit,
    objectPositionX: element.type === "shape" ? 50 : element.cropX,
    objectPositionY: element.type === "shape" ? 50 : element.cropY,
    scale: element.type === "shape" ? 1 : element.scale
  };

  if (element.type === "shape") {
    return {
      id: `${element.id}-shape`,
      kind: "text",
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      zIndex: element.zIndex,
      locked: element.locked,
      text: "",
      color: "transparent",
      fontSize: 1,
      fontWeight: 400,
      align: "left",
      background: element.fill,
      paddingX: 0,
      paddingY: 0,
      radius,
      letterSpacing: 0,
      textTransform: "none"
    };
  }

  return imageLayer;
}

function mapTextName(layer: TextLayer) {
  if (layer.id === "title") return "Titre";
  if (layer.id === "body") return "Corps";
  if (layer.id === "cta") return "CTA";
  if (layer.id === "brand") return "Marque";
  if (layer.id === "eyebrow") return "Étiquette";
  return "Texte";
}

function findPrimaryColor(document: InstagramDesignDocument) {
  const candidate = document.elements.find((element) => element.type === "shape") as ShapeDesignElement | undefined;
  return candidate?.fill ?? document.backgroundColor;
}

function shapeLabel(shape: ShapeDesignElement["shape"]) {
  return {
    rectangle: "Rectangle",
    circle: "Cercle",
    line: "Ligne",
    band: "Bandeau",
    frame: "Encadré",
    pill: "Pastille",
    divider: "Séparateur"
  }[shape];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function withOpacity(hex: string, opacity: number) {
  if (hex.startsWith("rgb")) {
    return hex.replace("rgb(", "rgba(").replace(")", `, ${opacity})`);
  }
  const normalized = hex.replace("#", "");
  const chunk = normalized.length === 3 ? normalized.split("").map((value) => value + value).join("") : normalized;
  const red = Number.parseInt(chunk.slice(0, 2), 16);
  const green = Number.parseInt(chunk.slice(2, 4), 16);
  const blue = Number.parseInt(chunk.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function pickSticker(title: string, caption: string, tone: MerchantBrandSettingsRow["tone"], visualStyle: MerchantBrandSettingsRow["visual_style"]) {
  const stickers =
    tone === "haut_de_gamme"
      ? ["✨", "🥂", "🤍", "⭐"]
      : tone === "convivial"
        ? ["☀️", "💬", "😊", "🌿", "🎉"]
        : visualStyle === "artisanal"
          ? ["🌿", "🪴", "✨", "🧺"]
          : ["✨", "📍", "💜", "⭐", "🌿"];
  return stickers[Math.abs(hashString(`${title}-${caption}`)) % stickers.length];
}

function getStylePack(tone: MerchantBrandSettingsRow["tone"], visualStyle: MerchantBrandSettingsRow["visual_style"]) {
  if (tone === "haut_de_gamme") {
    return {
      titlePrefix: "Élégance",
      titleSize: 68,
      titleLineHeight: 1.02,
      bodySize: 24,
      bodyLineHeight: 1.24,
      emojiSize: 34,
      bodyEmoji: "✨"
    };
  }
  if (tone === "convivial") {
    return {
      titlePrefix: visualStyle === "dynamique" ? "On aime" : "À découvrir",
      titleSize: 72,
      titleLineHeight: 1.04,
      bodySize: 26,
      bodyLineHeight: 1.22,
      emojiSize: 40,
      bodyEmoji: "😊"
    };
  }
  if (tone === "simple") {
    return {
      titlePrefix: "",
      titleSize: 70,
      titleLineHeight: 1.03,
      bodySize: 25,
      bodyLineHeight: 1.2,
      emojiSize: 34,
      bodyEmoji: "✨"
    };
  }
  return {
    titlePrefix: visualStyle === "premium" || visualStyle === "moderne" ? "À retenir" : "",
    titleSize: 72,
    titleLineHeight: 1.03,
    bodySize: 25,
    bodyLineHeight: 1.22,
    emojiSize: 36,
    bodyEmoji: "✨"
  };
}

function getKickerText(businessType: string | null | undefined, tone: MerchantBrandSettingsRow["tone"]) {
  const businessLabel = businessType?.trim() || "Commerce local";
  if (tone === "haut_de_gamme") return `${businessLabel} · Sélection`;
  if (tone === "convivial") return `${businessLabel} · Le moment`;
  if (tone === "simple") return `${businessLabel} · Focus`;
  return `${businessLabel} · À la une`;
}

function getFooterLine(tone: MerchantBrandSettingsRow["tone"], businessName: string) {
  if (tone === "haut_de_gamme") return `${businessName} · une attention portée aux détails`;
  if (tone === "convivial") return `${businessName} · un post pensé pour créer le lien`;
  if (tone === "simple") return `${businessName} · l’essentiel en un coup d’œil`;
  return `${businessName} · une prise de parole claire et soignée`;
}

function injectToneEmoji(text: string, emoji: string) {
  if (!text.trim()) return text;
  if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) return text;
  return `${emoji} ${text}`;
}

function getReadableTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  const chunk = normalized.length === 3 ? normalized.split("").map((value) => value + value).join("") : normalized;
  const red = Number.parseInt(chunk.slice(0, 2), 16);
  const green = Number.parseInt(chunk.slice(2, 4), 16);
  const blue = Number.parseInt(chunk.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? "#211432" : "#FFFFFF";
}
