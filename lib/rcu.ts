import { createImageElement, createShapeElement, createTextElement, FORMAT_DIMENSIONS } from "@/lib/social-editor/document";
import { getRcuConsumerBrand } from "@/lib/rcu-brand";
import type { InstagramDesignDocument } from "@/lib/social-editor/types";
import type { MerchantBrandSettingsRow, MerchantRow, RcuFormRow } from "@/lib/supabase/types";

export const RCU_FORM_TYPES = [
  "points",
  "wheel",
  "raffle",
  "stamps",
  "smart_hans"
] as const;

export type RcuFormType = typeof RCU_FORM_TYPES[number];

export type RcuReward = {
  points: number;
  label: string;
};

export type RcuGameConfig = {
  visitPoints?: number;
  fiveDayBonus?: number;
  reviewBonus?: number;
  rewards?: RcuReward[];
  wheelPrizes?: Array<{ label: string; weight: number }>;
  rafflePrize?: string;
  stampTarget?: number;
  stampReward?: string;
  inactivityDays?: number;
  inactivityMultiplier?: number;
  visitValidationEnabled?: boolean;
  visitValidationCode?: string;
  visitValidationUpdatedAt?: string;
};

export type RcuProgram = Omit<RcuFormRow, "form_type" | "game_config"> & {
  form_type: RcuFormType;
  game_config: RcuGameConfig;
};

export type RcuGameResult = {
  programType: RcuFormType;
  message: string;
  pointsDelta?: number;
  pointsTotal?: number;
  uniqueVisitDays?: number;
  reviewBonusApplied?: boolean;
  unlockedRewards?: RcuReward[];
  nextReward?: RcuReward | null;
  wheelPrize?: string;
  wheelPrizeIndex?: number;
  raffleTicket?: string;
  raffleMonth?: string;
  raffleTicketsTotal?: number;
  stampCount?: number;
  stampTarget?: number;
  stampCycle?: number;
  stampReward?: string;
  rewardUnlocked?: boolean;
  hansMultiplier?: number;
  hansPattern?: "welcome" | "regular" | "habit" | "inactive";
  hansOfferExpiresAt?: string;
  hansRecommendation?: string;
};

export type RcuTypeDefinition = {
  id: RcuFormType;
  label: string;
  shortLabel: string;
  description: string;
  targetLabel: string | null;
  targetPlaceholder: string | null;
  targetRequired?: boolean;
  usesLeadForm: boolean;
  supportsDiscount: boolean;
  defaultTitle: string;
  defaultIncentive: string;
  defaultCtaLabel: string;
  defaultPosterHeadline: string;
  defaultPosterBody: string;
  successMessage: string;
  badge: string;
};

export const RCU_TYPE_DEFINITIONS: RcuTypeDefinition[] = [
  {
    id: "points",
    label: "Système de points",
    shortLabel: "Points",
    description: "+10 points par visite, bonus de fréquence et récompenses configurables.",
    targetLabel: "Lien d’avis pour le bonus +100 points (optionnel)",
    targetPlaceholder: "https://g.page/r/…/review",
    usesLeadForm: true,
    supportsDiscount: false,
    defaultTitle: "Cumulez des points à chaque visite",
    defaultIncentive: "Scannez à chaque passage : +10 points, des bonus de régularité et des cadeaux à débloquer.",
    defaultCtaLabel: "Ajouter ma visite",
    defaultPosterHeadline: "Scannez. Cumulez. Gagnez.",
    defaultPosterBody: "+10 points à chaque visite et des récompenses à débloquer.",
    successMessage: "Votre visite et vos points sont enregistrés.",
    badge: "Préféré"
  },
  {
    id: "wheel",
    label: "Roue de la chance",
    shortLabel: "Roulette",
    description: "Une roue animée avec des gains pondérés et un coût maîtrisé.",
    targetLabel: null,
    targetPlaceholder: null,
    usesLeadForm: true,
    supportsDiscount: false,
    defaultTitle: "Tentez votre chance aujourd’hui",
    defaultIncentive: "Scannez à chaque visite et lancez la roue pour découvrir votre gain.",
    defaultCtaLabel: "Faire tourner la roue",
    defaultPosterHeadline: "La roue de la chance",
    defaultPosterBody: "Scannez et tentez de gagner une surprise en boutique.",
    successMessage: "La roue a parlé !",
    badge: "Engagement"
  },
  {
    id: "raffle",
    label: "Tombola mensuelle",
    shortLabel: "Tombola",
    description: "Chaque visite validée génère un ticket pour le tirage du mois.",
    targetLabel: null,
    targetPlaceholder: null,
    usesLeadForm: true,
    supportsDiscount: false,
    defaultTitle: "Gagnez votre ticket de tombola",
    defaultIncentive: "Chaque scan en boutique ajoute une chance au tirage mensuel.",
    defaultCtaLabel: "Recevoir mon ticket",
    defaultPosterHeadline: "1 scan = 1 chance",
    defaultPosterBody: "Participez à notre tombola mensuelle en quelques secondes.",
    successMessage: "Votre ticket est enregistré pour le prochain tirage.",
    badge: "Simple"
  },
  {
    id: "stamps",
    label: "Carte de fidélité numérique",
    shortLabel: "Visites",
    description: "Une carte de cinq visites sans support physique, avec cadeau automatique.",
    targetLabel: null,
    targetPlaceholder: null,
    usesLeadForm: true,
    supportsDiscount: false,
    defaultTitle: "Votre fidélité récompensée en 5 visites",
    defaultIncentive: "Validez une visite à chaque passage. La cinquième débloque votre cadeau.",
    defaultCtaLabel: "Valider ma visite",
    defaultPosterHeadline: "Votre 5e visite est offerte",
    defaultPosterBody: "Une carte de fidélité simple, directement sur votre téléphone.",
    successMessage: "Votre visite a été ajoutée à votre carte.",
    badge: "Fidélité"
  },
  {
    id: "smart_hans",
    label: "Fidélité intelligente par Hans",
    shortLabel: "Hans IA",
    description: "Hans adapte les bonus selon la fréquence, les habitudes et l’inactivité.",
    targetLabel: "Lien d’avis ou action recommandée (optionnel)",
    targetPlaceholder: "https://…",
    usesLeadForm: true,
    supportsDiscount: false,
    defaultTitle: "Hans personnalise votre récompense",
    defaultIncentive: "Scannez à chaque visite : Hans analyse votre rythme et active le bonus le plus pertinent.",
    defaultCtaLabel: "Découvrir mon bonus Hans",
    defaultPosterHeadline: "Votre fidélité devient intelligente",
    defaultPosterBody: "Hans adapte les récompenses à votre vraie fréquence de visite.",
    successMessage: "Hans a analysé votre visite et préparé votre bonus.",
    badge: "IA"
  }
];

export const LEGACY_RCU_TYPE_MAP: Record<string, RcuFormType> = {
  discount_signup: "points",
  review_google: "smart_hans",
  vip_signup: "stamps",
  newsletter_sms: "raffle",
  event_signup: "raffle",
  custom_link: "wheel"
};

export function isRcuFormType(value: string | null | undefined): value is RcuFormType {
  return RCU_FORM_TYPES.includes((value ?? "") as RcuFormType);
}

export function getRcuTypeDefinition(value: string | null | undefined) {
  return RCU_TYPE_DEFINITIONS.find((item) => item.id === value) ?? RCU_TYPE_DEFINITIONS[0];
}

export function slugifyRcuValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function normalizeRcuVisitCode(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{2,4}$/.test(normalized) ? normalized : null;
}

export function getPublicRcuProgram(program: RcuProgram): RcuProgram {
  const { visitValidationCode: _privateCode, ...publicGameConfig } = program.game_config;
  return { ...program, game_config: publicGameConfig };
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

function cleanLabel(value: unknown, fallback: string, maximum = 120) {
  return String(value ?? "").trim().slice(0, maximum) || fallback;
}

export function normalizeRcuGameConfig(type: RcuFormType, value: RcuGameConfig | null | undefined): RcuGameConfig {
  const config = value ?? {};
  const visitValidationCode = normalizeRcuVisitCode(config.visitValidationCode);
  const validation = {
    visitValidationEnabled: config.visitValidationEnabled !== false,
    ...(visitValidationCode ? { visitValidationCode } : {}),
    ...(config.visitValidationUpdatedAt ? { visitValidationUpdatedAt: config.visitValidationUpdatedAt } : {})
  };

  if (type === "points") {
    const fallback = getDefaultRcuGameConfig("points");
    const rewards = (config.rewards ?? fallback.rewards ?? [])
      .map((reward) => ({
        points: boundedInteger(reward.points, 1, 1, 100_000),
        label: cleanLabel(reward.label, "Récompense fidélité")
      }))
      .filter((reward, index, items) => items.findIndex((item) => item.points === reward.points) === index)
      .sort((left, right) => left.points - right.points)
      .slice(0, 10);
    return {
      ...validation,
      visitPoints: boundedInteger(config.visitPoints, fallback.visitPoints ?? 10, 1, 10_000),
      fiveDayBonus: boundedInteger(config.fiveDayBonus, fallback.fiveDayBonus ?? 50, 0, 100_000),
      reviewBonus: boundedInteger(config.reviewBonus, fallback.reviewBonus ?? 100, 0, 100_000),
      rewards: rewards.length ? rewards : fallback.rewards
    };
  }

  if (type === "wheel") {
    const fallback = getDefaultRcuGameConfig("wheel");
    const prizes = (config.wheelPrizes ?? fallback.wheelPrizes ?? [])
      .map((prize) => ({
        label: cleanLabel(prize.label, "Retentez votre chance"),
        weight: boundedInteger(prize.weight, 1, 1, 10_000)
      }))
      .slice(0, 12);
    return { ...validation, wheelPrizes: prizes.length >= 2 ? prizes : fallback.wheelPrizes };
  }

  if (type === "raffle") {
    return { ...validation, rafflePrize: cleanLabel(config.rafflePrize, "Un panier garni") };
  }

  if (type === "stamps") {
    return {
      ...validation,
      stampTarget: boundedInteger(config.stampTarget, 5, 2, 30),
      stampReward: cleanLabel(config.stampReward, "Votre cadeau fidélité")
    };
  }

  return {
    ...validation,
    visitPoints: boundedInteger(config.visitPoints, 10, 1, 10_000),
    inactivityDays: boundedInteger(config.inactivityDays, 25, 1, 365),
    inactivityMultiplier: boundedInteger(config.inactivityMultiplier, 2, 1, 5)
  };
}

export function buildRcuPublicUrl(origin: string, slug: string) {
  return `${origin.replace(/\/$/, "")}/rcu/${slug}`;
}

export function buildRcuQrApiUrl(origin: string, slug: string, size = 360) {
  const data = buildRcuPublicUrl(origin, slug);
  return `${origin.replace(/\/$/, "")}/api/rcu/qr?size=${size}&data=${encodeURIComponent(data)}`;
}

export function getRcuCtaHref(form: Pick<RcuFormRow, "slug" | "target_url" | "form_type">, origin: string) {
  const type = getRcuTypeDefinition(form.form_type);
  if (!type.usesLeadForm && form.target_url?.trim()) {
    return form.target_url.trim();
  }

  return buildRcuPublicUrl(origin, form.slug);
}

export function getRcuDefaultDraft(type: RcuFormType, businessName?: string | null) {
  const definition = getRcuTypeDefinition(type);
  const baseName = slugifyRcuValue(businessName ?? "atriumone") || "atriumone";

  return {
    title: definition.defaultTitle,
    incentiveText: definition.defaultIncentive,
    slug: `${baseName}-${definition.id.replace(/_/g, "-")}`,
    discountLabel: "",
    discountValue: 0,
    ctaLabel: definition.defaultCtaLabel,
    targetUrl: "",
    successMessage: definition.successMessage,
    posterHeadline: definition.defaultPosterHeadline,
    posterBody: definition.defaultPosterBody,
    posterTheme: type,
    gameConfig: getDefaultRcuGameConfig(type)
  };
}

export function getDefaultRcuGameConfig(type: RcuFormType): RcuGameConfig {
  if (type === "points") {
    return {
      visitPoints: 10,
      fiveDayBonus: 50,
      reviewBonus: 100,
      rewards: [
        { points: 100, label: "Café offert" },
        { points: 250, label: "Viennoiserie offerte" },
        { points: 500, label: "Baguette + pâtisserie" }
      ]
    };
  }
  if (type === "wheel") {
    return {
      wheelPrizes: [
        { label: "-10 %", weight: 5 },
        { label: "Un café offert", weight: 10 },
        { label: "Une pâtisserie offerte", weight: 5 },
        { label: "Retentez votre chance", weight: 80 }
      ]
    };
  }
  if (type === "raffle") return { rafflePrize: "Un panier garni" };
  if (type === "stamps") return { stampTarget: 5, stampReward: "Votre cadeau fidélité" };
  return { visitPoints: 10, inactivityDays: 25, inactivityMultiplier: 2 };
}

export function createRcuPosterDocument({
  form,
  origin,
  merchant,
  brandSettings,
  format = "a4",
  heroImageUrl
}: {
  form: Pick<
    RcuFormRow,
    | "slug"
    | "title"
    | "incentive_text"
    | "discount_label"
    | "discount_value"
    | "form_type"
    | "cta_label"
    | "poster_headline"
    | "poster_body"
  >;
  origin: string;
  merchant?: MerchantRow | null;
  brandSettings?: MerchantBrandSettingsRow | null;
  format?: "a4";
  heroImageUrl?: string | null;
}): InstagramDesignDocument {
  const definition = getRcuTypeDefinition(form.form_type);
  const brand = getRcuConsumerBrand(merchant, brandSettings);
  const { primary, accent, ink, surface, soft, border, onPrimary } = brand;
  const fontFamily = brand.fontName;
  const titleFontFamily = brand.titleFontName;
  const businessName = merchant?.business_name?.trim() || "Votre boutique";
  const businessDetails = [merchant?.business_type, merchant?.city].filter(Boolean).join(" · ") || "Programme de fidélité";
  const qrUrl = buildRcuQrApiUrl(origin, form.slug, 720);
  const headline = truncatePosterText(form.poster_headline?.trim() || definition.defaultPosterHeadline, 76);
  const body = truncatePosterText(form.poster_body?.trim() || form.incentive_text || definition.defaultPosterBody, 200);
  const cta = truncatePosterText(form.cta_label?.trim() || definition.defaultCtaLabel, 28);
  const dimensions = FORMAT_DIMENSIONS[format];
  const document: InstagramDesignDocument = {
    version: 2,
    format,
    postTitle: `Affiche RCU · ${headline}`,
    caption: body,
    hashtags: "",
    altText: `${headline} — ${businessName}`,
    backgroundColor: surface,
    backgroundImage: null,
    safetyMargin: true,
    elements: []
  };
  const motif = form.form_type === "points"
    ? "+10 points par visite"
    : form.form_type === "wheel"
      ? "Une chance à chaque visite"
      : form.form_type === "raffle"
        ? "1 scan = 1 ticket"
        : form.form_type === "stamps"
          ? "Votre fidélité récompensée"
          : "Des avantages personnalisés";

  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, surface),
    name: "Fond A4",
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
    fill: surface,
    borderColor: surface,
    borderWidth: 0,
    borderRadius: 0,
    zIndex: 0
  });

  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, primary),
    name: "Liseré de marque",
    x: 0,
    y: 0,
    width: dimensions.width,
    height: 18,
    fill: primary,
    borderColor: primary,
    borderWidth: 0,
    borderRadius: 0,
    zIndex: 1
  });
  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, "#FFFFFF"),
    name: "Feuille éditoriale",
    x: 46,
    y: 48,
    width: 1148,
    height: 1658,
    fill: "#FFFFFF",
    borderColor: border,
    borderWidth: 2,
    borderRadius: 42,
    shadow: true,
    zIndex: 2
  });
  document.elements.push({
    ...createShapeElement("circle", dimensions.width, dimensions.height, soft),
    name: "Décor de marque",
    x: 1000,
    y: 74,
    width: 160,
    height: 160,
    fill: soft,
    borderColor: soft,
    borderWidth: 0,
    borderRadius: 999,
    zIndex: 3
  });

  const headerTextX = merchant?.logo_url ? 230 : 88;
  document.elements.push({
    ...createTextElement("subtitle", dimensions.width, dimensions.height),
    name: "Nom du commerce",
    text: businessName,
    x: headerTextX,
    y: 88,
    width: merchant?.logo_url ? 720 : 850,
    height: 52,
    color: ink,
    fontFamily: titleFontFamily,
    fontSize: 30,
    fontWeight: 700,
    align: "left",
    zIndex: 5
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Informations commerce",
    text: businessDetails.toUpperCase(),
    x: headerTextX,
    y: 144,
    width: merchant?.logo_url ? 720 : 850,
    height: 34,
    color: primary,
    fontFamily,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1.4,
    align: "left",
    zIndex: 5
  });
  if (merchant?.logo_url) {
    document.elements.push({
      ...createImageElement(merchant.logo_url, dimensions.width, dimensions.height, `Logo ${businessName}`),
      type: "logo",
      x: 88,
      y: 78,
      width: 112,
      height: 112,
      fit: "contain",
      borderRadius: 18,
      shadow: false,
      zIndex: 6
    });
  }
  document.elements.push({
    ...createShapeElement("divider", dimensions.width, dimensions.height, border),
    name: "Séparateur d’en-tête",
    x: 88,
    y: 218,
    width: 1064,
    height: 2,
    fill: border,
    borderColor: border,
    borderWidth: 0,
    borderRadius: 2,
    zIndex: 4
  });
  document.elements.push({
    ...createShapeElement("pill", dimensions.width, dimensions.height, soft),
    name: "Programme fidélité",
    x: 88,
    y: 266,
    width: 330,
    height: 52,
    fill: soft,
    borderColor: border,
    borderWidth: 1,
    borderRadius: 999,
    zIndex: 4
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Type de programme",
    text: `PROGRAMME ${definition.shortLabel.toUpperCase()}`,
    x: 112,
    y: 280,
    width: 282,
    height: 26,
    color: primary,
    fontFamily,
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: 1.35,
    align: "center",
    zIndex: 5
  });
  document.elements.push({
    ...createTextElement("title", dimensions.width, dimensions.height),
    name: "Titre de l’affiche",
    text: headline,
    x: 88,
    y: 354,
    width: 1064,
    height: 210,
    color: ink,
    fontFamily: titleFontFamily,
    fontSize: headline.length > 48 ? 66 : 78,
    fontWeight: 700,
    lineHeight: 1.06,
    align: "left",
    zIndex: 5
  });
  document.elements.push({
    ...createTextElement("body", dimensions.width, dimensions.height),
    name: "Texte de l’affiche",
    text: body,
    x: 88,
    y: 590,
    width: 950,
    height: 120,
    color: ink,
    fontFamily,
    fontSize: body.length > 150 ? 26 : 31,
    fontWeight: 500,
    lineHeight: 1.42,
    align: "left",
    zIndex: 5
  });

  const storyPanelY = 760;
  const storyPanelHeight = 700;
  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, soft),
    name: "Carte découverte",
    x: 78,
    y: storyPanelY,
    width: 648,
    height: storyPanelHeight,
    fill: soft,
    borderColor: border,
    borderWidth: 2,
    borderRadius: 36,
    shadow: false,
    zIndex: 4
  });
  if (heroImageUrl) {
    document.elements.push({
      ...createImageElement(heroImageUrl, dimensions.width, dimensions.height, "Univers du commerce"),
      x: 78,
      y: storyPanelY,
      width: 648,
      height: 400,
      fit: "cover",
      cropX: 50,
      cropY: 50,
      scale: 1.04,
      borderRadius: 36,
      shadow: false,
      zIndex: 5
    });
  }
  const storyCopyY = heroImageUrl ? 1194 : 842;
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Promesse fidélité",
    text: motif.toUpperCase(),
    x: 122,
    y: storyCopyY,
    width: 560,
    height: 42,
    color: primary,
    fontFamily,
    fontSize: motif.length > 24 ? 20 : 23,
    fontWeight: 800,
    letterSpacing: 1.25,
    align: "left",
    zIndex: 7
  });
  if (!heroImageUrl) {
    document.elements.push({
      ...createTextElement("title", dimensions.width, dimensions.height),
      name: "Invitation",
      text: "Votre prochain avantage commence ici.",
      x: 122,
      y: 930,
      width: 530,
      height: 210,
      color: ink,
      fontFamily: titleFontFamily,
      fontSize: 49,
      fontWeight: 700,
      lineHeight: 1.08,
      align: "left",
      zIndex: 7
    });
  }
  const stepsY = heroImageUrl ? 1284 : 1190;
  ["Scannez", "Inscrivez-vous", "Profitez"].forEach((label, index) => {
    const x = 112 + index * 196;
    document.elements.push({
      ...createShapeElement("rectangle", dimensions.width, dimensions.height, "#FFFFFF"),
      name: `Étape ${index + 1}`,
      x,
      y: stepsY,
      width: 178,
      height: 112,
      fill: "#FFFFFF",
      borderColor: border,
      borderWidth: 1,
      borderRadius: 18,
      shadow: false,
      zIndex: 7
    });
    document.elements.push({
      ...createTextElement("small", dimensions.width, dimensions.height),
      name: `Numéro étape ${index + 1}`,
      text: `0${index + 1}`,
      x: x + 16,
      y: stepsY + 15,
      width: 48,
      height: 28,
      color: accent,
      fontFamily,
      fontSize: 16,
      fontWeight: 800,
      align: "left",
      zIndex: 8
    });
    document.elements.push({
      ...createTextElement("small", dimensions.width, dimensions.height),
      name: `Libellé étape ${index + 1}`,
      text: label,
      x: x + 16,
      y: stepsY + 55,
      width: 146,
      height: 34,
      color: ink,
      fontFamily,
      fontSize: 18,
      fontWeight: 700,
      align: "left",
      zIndex: 8
    });
  });

  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, "#FFFFFF"),
    name: "Carte QR",
    x: 762,
    y: storyPanelY,
    width: 400,
    height: storyPanelHeight,
    fill: "#FFFFFF",
    borderColor: border,
    borderWidth: 2,
    borderRadius: 36,
    shadow: true,
    zIndex: 8
  });
  document.elements.push({
    ...createImageElement(qrUrl, dimensions.width, dimensions.height, "QR code"),
    type: "image",
    x: 792,
    y: 830,
    width: 340,
    height: 340,
    borderRadius: 0,
    fit: "contain",
    cropX: 50,
    cropY: 50,
    scale: 1,
    shadow: false,
    zIndex: 10
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Instruction QR",
    text: "SCANNEZ POUR COMMENCER",
    x: 794,
    y: 1208,
    width: 336,
    height: 38,
    color: primary,
    fontFamily,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: 1.1,
    align: "center",
    zIndex: 11
  });
  document.elements.push({
    ...createTextElement("body", dimensions.width, dimensions.height),
    name: "Explication QR",
    text: "Ouvrez l’appareil photo de votre téléphone et pointez-le vers le QR code.",
    x: 806,
    y: 1262,
    width: 312,
    height: 82,
    color: ink,
    fontFamily,
    fontSize: 20,
    fontWeight: 500,
    lineHeight: 1.35,
    align: "center",
    zIndex: 11
  });
  document.elements.push({
    ...createShapeElement("pill", dimensions.width, dimensions.height, primary),
    name: "Bouton d’action",
    x: 814,
    y: 1360,
    width: 296,
    height: 70,
    fill: primary,
    borderColor: primary,
    borderWidth: 0,
    borderRadius: 18,
    shadow: false,
    zIndex: 10
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Action QR",
    text: cta,
    x: 834,
    y: 1380,
    width: 256,
    height: 34,
    color: onPrimary,
    fontFamily,
    fontSize: cta.length > 24 ? 17 : 20,
    fontWeight: 800,
    align: "center",
    zIndex: 11
  });
  document.elements.push({
    ...createShapeElement("divider", dimensions.width, dimensions.height, border),
    name: "Séparateur de pied de page",
    x: 88,
    y: 1552,
    width: 1064,
    height: 2,
    fill: border,
    borderColor: border,
    borderWidth: 0,
    borderRadius: 2,
    zIndex: 4
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Signature commerce",
    text: `À bientôt chez ${businessName}`,
    x: 88,
    y: 1604,
    width: 720,
    height: 44,
    color: ink,
    fontFamily: titleFontFamily,
    fontSize: 26,
    fontWeight: 700,
    align: "left",
    zIndex: 10
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Mention pratique",
    text: "Une inscription simple, directement sur votre téléphone",
    x: 760,
    y: 1610,
    width: 392,
    height: 36,
    color: primary,
    fontFamily,
    fontSize: 16,
    fontWeight: 700,
    align: "right",
    zIndex: 10
  });

  return document;
}

function truncatePosterText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const candidate = normalized.slice(0, maxLength + 1);
  const lastSpace = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastSpace > maxLength * 0.7 ? lastSpace : maxLength).trim()}…`;
}
