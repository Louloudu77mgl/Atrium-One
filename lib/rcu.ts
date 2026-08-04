import { createGeneratedDesignDocument, createImageElement, createShapeElement, createTextElement, FORMAT_DIMENSIONS } from "@/lib/social-editor/document";
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

export type RcuProgram = Omit<RcuFormRow, "form_type"> & {
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
  format = "portrait"
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
  format?: "square" | "portrait" | "story";
}): InstagramDesignDocument {
  const definition = getRcuTypeDefinition(form.form_type);
  const primary = brandSettings?.primary_color ?? "#4C1D95";
  const accent = brandSettings?.accent_color ?? "#A855F7";
  const fontFamily = brandSettings?.social_font_family ?? "Inter";
  const businessName = merchant?.business_name?.trim() || "Votre boutique";
  const qrUrl = buildRcuQrApiUrl(origin, form.slug, 480);
  const headline = form.poster_headline?.trim() || definition.defaultPosterHeadline;
  const body = form.poster_body?.trim() || form.incentive_text || definition.defaultPosterBody;
  const cta = form.cta_label?.trim() || definition.defaultCtaLabel;
  const dimensions = FORMAT_DIMENSIONS[format];
  const document = createGeneratedDesignDocument({
    title: headline,
    caption: body,
    visualHook: headline,
    visualSubtitle: body,
    merchant,
    brandSettings
  });
  document.format = format;
  document.altText = `${headline} — ${businessName}`;
  const qrY = Math.round(dimensions.height * 0.4);
  const motifY = Math.round(dimensions.height * 0.59);
  const footerY = dimensions.height - 72;
  const motif = form.form_type === "points"
    ? "+10 POINTS"
    : form.form_type === "wheel"
      ? "TOURNEZ LA ROUE"
      : form.form_type === "raffle"
        ? "1 SCAN = 1 TICKET"
        : form.form_type === "stamps"
          ? "1 · 2 · 3 · 4 · 🎁"
          : "BONUS HANS IA";

  document.elements = document.elements.map((element) => {
    if (element.name === "Fond principal") return { ...element, width: dimensions.width, height: dimensions.height };
    if (element.name === "Accroche") return { ...element, x: 78, y: 92, width: 620, height: 230, align: "left" as const };
    if (element.name === "Tiret d’accent") return { ...element, x: 82, y: 330 };
    if (element.name === "Sous-titre") return { ...element, x: 82, y: 362, width: 540, height: 150, align: "left" as const };
    if (element.name === "Signature") return { ...element, x: 82, y: footerY, width: 620, align: "left" as const };
    return element;
  });

  document.elements.push({
    ...createShapeElement("circle", dimensions.width, dimensions.height, "rgba(255,255,255,0.13)"),
    name: `Motif ${definition.shortLabel}`,
    x: 72,
    y: motifY,
    width: 500,
    height: 500,
    fill: "rgba(255,255,255,0.10)",
    borderColor: accent,
    borderWidth: 5,
    borderRadius: 999,
    zIndex: 2
  });
  document.elements.push({
    ...createTextElement("title", dimensions.width, dimensions.height),
    name: "Mécanique RCU",
    text: motif,
    x: 122,
    y: motifY + 176,
    width: 400,
    height: 150,
    color: "#FFFFFF",
    fontFamily,
    fontSize: motif.length > 14 ? 44 : 62,
    fontWeight: 900,
    align: "center",
    lineHeight: 1.02,
    zIndex: 4
  });
  document.elements.push({
    ...createShapeElement("rectangle", dimensions.width, dimensions.height, "#FFFFFF"),
    name: "Carte QR Hans",
    x: 650,
    y: qrY,
    width: 354,
    height: 470,
    fill: "#FFFFFF",
    borderColor: "#FFFFFF",
    borderWidth: 0,
    borderRadius: 40,
    shadow: true,
    zIndex: 8
  });
  document.elements.push({
    ...createImageElement(qrUrl, dimensions.width, dimensions.height, "QR code"),
    type: "image",
    x: 702,
    y: qrY + 50,
    width: 250,
    height: 250,
    borderRadius: 22,
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
    x: 684,
    y: qrY + 326,
    width: 286,
    height: 46,
    color: primary,
    fontFamily,
    fontSize: 30,
    fontWeight: 900,
    align: "center",
    zIndex: 11
  });
  document.elements.push({
    ...createTextElement("small", dimensions.width, dimensions.height),
    name: "CTA QR",
    text: cta,
    x: 684,
    y: qrY + 382,
    width: 286,
    height: 48,
    color: primary,
    fontFamily,
    fontSize: 20,
    fontWeight: 700,
    align: "center",
    zIndex: 11
  });

  if (merchant?.logo_url && !document.elements.some((element) => element.type === "logo")) {
    document.elements.push({
      ...createImageElement(merchant.logo_url, dimensions.width, dimensions.height, "Logo du commerce"),
      type: "logo",
      x: 900,
      y: 72,
      width: 110,
      height: 110,
      fit: "contain",
      borderRadius: 20,
      shadow: true,
      zIndex: 12
    });
  }

  return document;
}
