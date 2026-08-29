import { createImageElement, createShapeElement, createTextElement, FORMAT_DIMENSIONS } from "@/lib/social-editor/document";
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
  const primary = brandSettings?.primary_color ?? "#4C1D95";
  const secondary = brandSettings?.secondary_color ?? "#F3E8FF";
  const accent = brandSettings?.accent_color ?? "#A855F7";
  const fontFamily = brandSettings?.social_font_family ?? "Inter";
  const businessName = merchant?.business_name?.trim() || "Votre boutique";
  const qrUrl = buildRcuQrApiUrl(origin, form.slug, 480);
  const headline = form.poster_headline?.trim() || definition.defaultPosterHeadline;
  const body = form.poster_body?.trim() || form.incentive_text || definition.defaultPosterBody;
  const cta = form.cta_label?.trim() || definition.defaultCtaLabel;
  const dimensions = FORMAT_DIMENSIONS[format];
  const document: InstagramDesignDocument = {
    version: 2,
    format,
    postTitle: `Affiche RCU · ${headline}`,
    caption: body,
    hashtags: "",
    altText: `${headline} — ${businessName}`,
    backgroundColor: secondary,
    backgroundImage: null,
    safetyMargin: true,
    elements: []
  };
  const motif = form.form_type === "points"
    ? "+10 POINTS"
    : form.form_type === "wheel"
      ? "TOURNEZ LA ROUE"
      : form.form_type === "raffle"
        ? "1 SCAN = 1 TICKET"
        : form.form_type === "stamps"
          ? "1 · 2 · 3 · 4 · CADEAU"
          : "BONUS HANS IA";

  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, secondary),
    name: "Fond A4",
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
    fill: secondary,
    borderColor: secondary,
    borderWidth: 0,
    borderRadius: 0,
    zIndex: 0
  });

  if (heroImageUrl) {
    document.elements.push({
      ...createImageElement(heroImageUrl, dimensions.width, dimensions.height, "Visuel principal RCU"),
      x: 0,
      y: 0,
      width: dimensions.width,
      height: 805,
      fit: "cover",
      cropX: 50,
      cropY: 50,
      scale: 1.08,
      borderRadius: 0,
      shadow: false,
      zIndex: 1
    });
  }

  document.elements.push({
    ...createImageElement(createRcuPosterGradient(primary, accent, Boolean(heroImageUrl)), dimensions.width, dimensions.height, "Dégradé de marque"),
    x: 0,
    y: 0,
    width: dimensions.width,
    height: 860,
    fit: "cover",
    borderRadius: 0,
    shadow: false,
    zIndex: 2
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Type de support",
    text: `PROGRAMME ${definition.shortLabel.toUpperCase()}`,
    x: 82,
    y: 106,
    width: 560,
    height: 42,
    color: "#FFFFFF",
    fontFamily,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: 1.8,
    align: "left",
    zIndex: 4
  });
  document.elements.push({
    ...createTextElement("title", dimensions.width, dimensions.height),
    name: "Titre de l’affiche",
    text: headline,
    x: 78,
    y: 230,
    width: 980,
    height: 360,
    color: "#FFFFFF",
    fontFamily,
    fontSize: headline.length > 48 ? 76 : 92,
    fontWeight: 900,
    lineHeight: 1.02,
    align: "left",
    zIndex: 4
  });
  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, primary),
    name: "Bloc explication",
    x: 70,
    y: 850,
    width: 650,
    height: 710,
    fill: primary,
    borderColor: primary,
    borderWidth: 0,
    borderRadius: 42,
    shadow: true,
    zIndex: 4
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Mécanique fidélité",
    text: motif,
    x: 120,
    y: 930,
    width: 550,
    height: 58,
    color: "#FFFFFF",
    fontFamily,
    fontSize: motif.length > 18 ? 30 : 38,
    fontWeight: 900,
    letterSpacing: 1,
    align: "left",
    zIndex: 6
  });
  document.elements.push({
    ...createTextElement("body", dimensions.width, dimensions.height),
    name: "Texte de l’affiche",
    text: body,
    x: 120,
    y: 1050,
    width: 520,
    height: 330,
    color: "#FFFFFF",
    fontFamily,
    fontSize: body.length > 150 ? 31 : 36,
    fontWeight: 600,
    lineHeight: 1.34,
    align: "left",
    zIndex: 6
  });
  document.elements.push({
    ...createShapeElement("pill", dimensions.width, dimensions.height, accent),
    name: "Pastille action",
    x: 120,
    y: 1430,
    width: 410,
    height: 74,
    fill: accent,
    borderColor: accent,
    borderWidth: 0,
    borderRadius: 999,
    zIndex: 6
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Action fidélité",
    text: cta,
    x: 145,
    y: 1447,
    width: 360,
    height: 40,
    color: "#FFFFFF",
    fontFamily,
    fontSize: 24,
    fontWeight: 800,
    align: "center",
    zIndex: 7
  });
  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, "#FFFFFF"),
    name: "Carte QR",
    x: 770,
    y: 900,
    width: 400,
    height: 570,
    fill: "#FFFFFF",
    borderColor: "#FFFFFF",
    borderWidth: 0,
    borderRadius: 44,
    shadow: true,
    zIndex: 8
  });
  document.elements.push({
    ...createImageElement(qrUrl, dimensions.width, dimensions.height, "QR code"),
    type: "image",
    x: 820,
    y: 960,
    width: 300,
    height: 300,
    borderRadius: 24,
    fit: "contain",
    cropX: 50,
    cropY: 50,
    scale: 1,
    shadow: false,
    zIndex: 10
  });
  document.elements.push({
    ...createTextElement("body", dimensions.width, dimensions.height),
    name: "Instruction QR",
    text: "SCANNEZ ICI",
    x: 810,
    y: 1310,
    width: 320,
    height: 46,
    color: primary,
    fontFamily,
    fontSize: 32,
    fontWeight: 900,
    align: "center",
    zIndex: 11
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "CTA QR",
    text: cta,
    x: 810,
    y: 1370,
    width: 320,
    height: 58,
    color: primary,
    fontFamily,
    fontSize: 22,
    fontWeight: 700,
    align: "center",
    zIndex: 11
  });

  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "Signature commerce",
    text: businessName,
    x: 76,
    y: 1650,
    width: 900,
    height: 46,
    color: primary,
    fontFamily,
    fontSize: 27,
    fontWeight: 800,
    align: "left",
    zIndex: 10
  });

  if (merchant?.logo_url) {
    document.elements.push({
      ...createImageElement(merchant.logo_url, dimensions.width, dimensions.height, "Logo du commerce"),
      type: "logo",
      x: 1030,
      y: 72,
      width: 120,
      height: 120,
      fit: "contain",
      borderRadius: 18,
      shadow: false,
      zIndex: 12
    });
  }

  return document;
}

function createRcuPosterGradient(primary: string, accent: string, hasImage: boolean) {
  const topOpacity = hasImage ? "0.42" : "1";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="860" viewBox="0 0 1240 860"><defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}" stop-opacity="${topOpacity}"/><stop offset="0.62" stop-color="${primary}" stop-opacity="0.72"/><stop offset="1" stop-color="${accent}" stop-opacity="0.9"/></linearGradient><linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#120E1C" stop-opacity="0"/><stop offset="1" stop-color="#120E1C" stop-opacity="0.72"/></linearGradient></defs><rect width="1240" height="860" fill="url(#brand)"/><rect width="1240" height="860" fill="url(#bottom)"/><circle cx="1100" cy="80" r="260" fill="#fff" fill-opacity="0.08"/><circle cx="980" cy="720" r="180" fill="#fff" fill-opacity="0.06"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
