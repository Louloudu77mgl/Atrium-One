import type { MerchantAutomationSettingsRow } from "@/lib/supabase/types";

export const DEFAULT_SENSITIVE_KEYWORDS = [
  "remboursement",
  "arnaque",
  "scandale",
  "honteux",
  "plainte",
  "avocat",
  "dangereux",
  "intoxication",
  "blessure",
  "vol",
  "insulte"
] as const;

export const REVIEW_AUTOMATION_MODES = ["disabled", "semi_automatic", "automatic_guarded"] as const;
export const REVIEW_AUTOMATION_ACTIONS = ["disabled", "validation", "automatic"] as const;

export type ReviewAutomationMode = (typeof REVIEW_AUTOMATION_MODES)[number];
export type ReviewAutomationAction = (typeof REVIEW_AUTOMATION_ACTIONS)[number];

export type ReviewAutomationDecision = {
  action: ReviewAutomationAction;
  requiresValidation: boolean;
  blockedBySafety: boolean;
  sensitiveKeyword: string | null;
};

export function normalizeAutomationMode(value: string | null | undefined): ReviewAutomationMode {
  if (value === "semi_automatic" || value === "automatic_guarded") {
    return value;
  }

  return "disabled";
}

export function getConfiguredAutomationMode(settings?: Partial<MerchantAutomationSettingsRow> | null): ReviewAutomationMode {
  const explicitMode = normalizeAutomationMode(settings?.review_automation_mode);
  if (explicitMode !== "disabled" || settings?.review_automation_mode === "disabled") {
    return explicitMode;
  }

  return settings?.reviews_auto_reply_enabled === true ? "automatic_guarded" : "disabled";
}

export function normalizeAutomationAction(value: string | null | undefined, fallback: ReviewAutomationAction): ReviewAutomationAction {
  if (value === "disabled" || value === "validation" || value === "automatic") {
    return value;
  }

  return fallback;
}

export function getSensitiveKeywords(settings?: Partial<MerchantAutomationSettingsRow> | null) {
  const values = settings?.sensitive_keywords?.length
    ? settings.sensitive_keywords
    : [...DEFAULT_SENSITIVE_KEYWORDS];

  return values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function findSensitiveKeyword(reviewText: string, settings?: Partial<MerchantAutomationSettingsRow> | null) {
  const normalized = reviewText.toLowerCase();
  return getSensitiveKeywords(settings).find((keyword) => normalized.includes(keyword)) ?? null;
}

export function getAutomationActionForRating(
  rating: number,
  settings?: Partial<MerchantAutomationSettingsRow> | null,
  fallback: ReviewAutomationAction = "disabled"
): ReviewAutomationAction {
  if (rating >= 5) {
    return normalizeAutomationAction(settings?.reviews_five_star_action, fallback);
  }

  if (rating === 4) {
    return normalizeAutomationAction(settings?.reviews_four_star_action, fallback);
  }

  if (rating === 3) {
    return normalizeAutomationAction(settings?.reviews_three_star_action, fallback);
  }

  return normalizeAutomationAction(settings?.reviews_one_two_star_action, fallback);
}

export function getReviewAutomationDecision({
  rating,
  reviewText,
  settings
}: {
  rating: number;
  reviewText: string;
  settings?: Partial<MerchantAutomationSettingsRow> | null;
}): ReviewAutomationDecision {
  const mode = getConfiguredAutomationMode(settings);

  if (mode === "disabled") {
    return {
      action: "disabled",
      requiresValidation: false,
      blockedBySafety: false,
      sensitiveKeyword: null
    };
  }

  const fallbackAction: ReviewAutomationAction = mode === "semi_automatic" ? "validation" : "automatic";
  const ratingAction = getAutomationActionForRating(rating, settings, fallbackAction);
  const sensitiveKeyword = settings?.block_sensitive_reviews === true ? findSensitiveKeyword(reviewText, settings) : null;

  if (sensitiveKeyword) {
    return {
      action: "validation",
      requiresValidation: true,
      blockedBySafety: true,
      sensitiveKeyword
    };
  }

  if (settings?.always_validate_negative_reviews === true && rating <= 2) {
    return {
      action: "validation",
      requiresValidation: true,
      blockedBySafety: false,
      sensitiveKeyword: null
    };
  }

  if (mode === "semi_automatic") {
    return {
      action: "validation",
      requiresValidation: true,
      blockedBySafety: false,
      sensitiveKeyword: null
    };
  }

  if (ratingAction === "automatic") {
    return {
      action: "automatic",
      requiresValidation: false,
      blockedBySafety: false,
      sensitiveKeyword: null
    };
  }

  if (ratingAction === "validation") {
    return {
      action: "validation",
      requiresValidation: true,
      blockedBySafety: false,
      sensitiveKeyword: null
    };
  }

  return {
    action: "disabled",
    requiresValidation: false,
    blockedBySafety: false,
    sensitiveKeyword: null
  };
}

export function getAutomationSummary(settings?: Partial<MerchantAutomationSettingsRow> | null) {
  const mode = getConfiguredAutomationMode(settings);
  const parts: string[] = [];

  if (mode === "disabled") {
    return "Automatisation désactivée : Hans prépare des brouillons, mais ne publie rien sans votre accord.";
  }

  const fallbackAction: ReviewAutomationAction = mode === "semi_automatic" ? "validation" : "automatic";

  if (normalizeAutomationAction(settings?.reviews_five_star_action, fallbackAction) === "automatic") {
    parts.push("répond automatiquement aux avis 5 étoiles");
  } else {
    parts.push("prépare les avis 5 étoiles pour validation");
  }

  if (settings?.always_validate_negative_reviews === true) {
    parts.push("demande toujours votre validation pour les avis négatifs");
  }

  if (settings?.block_sensitive_reviews === true) {
    parts.push("bloque les avis sensibles pour relecture");
  }

  return `Automatisation active : Hans ${parts.join(", ")}.`;
}
