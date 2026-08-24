import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStoredAutomationSettings, saveStoredAutomationSettings } from "@/lib/automation-execution-store";
import { getMerchant } from "@/lib/merchants";
import {
  DEFAULT_SENSITIVE_KEYWORDS,
  getConfiguredAutomationMode,
  getAutomationSummary,
  normalizeAutomationAction,
  normalizeAutomationMode,
  type ReviewAutomationAction,
  type ReviewAutomationMode
} from "@/lib/review-automation";
import { getMaxPostsForCycle } from "@/lib/social-automation-shared";
import { ensureAutomatedSocialDrafts } from "@/lib/social-automation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MerchantAutomationSettingsRow, MerchantRow } from "@/lib/supabase/types";

export const DEFAULT_AUTOMATION_SETTINGS = {
  reviews_auto_reply_enabled: false,
  review_automation_mode: "disabled" as ReviewAutomationMode,
  reviews_five_star_action: "disabled" as ReviewAutomationAction,
  reviews_four_star_action: "disabled" as ReviewAutomationAction,
  reviews_three_star_action: "disabled" as ReviewAutomationAction,
  reviews_one_two_star_action: "disabled" as ReviewAutomationAction,
  always_validate_negative_reviews: false,
  block_sensitive_reviews: false,
  sensitive_keywords: [] as string[],
  social_auto_publish_enabled: false,
  social_auto_publish_live: false,
  social_posts_per_week: 1,
  social_posts_per_cycle: 1,
  social_cycle_weeks: 1
} as const;

export async function getAutomationSettings(merchant?: MerchantRow | null): Promise<MerchantAutomationSettingsRow | null> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("merchant_automation_settings")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      return null;
    }

    throw new Error(error.message);
  }

  const storedSettings = await getStoredAutomationSettings(currentMerchant.id).catch(() => null);
  return data && storedSettings
    ? { ...data, ...storedSettings, id: data.id, merchant_id: data.merchant_id, created_at: data.created_at }
    : data;
}

function normalizeInteger(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getSocialAutomationCadence(settings?: Partial<MerchantAutomationSettingsRow> | null) {
  const postsPerCycle = normalizeInteger(
    settings?.social_posts_per_cycle ?? settings?.social_posts_per_week ?? DEFAULT_AUTOMATION_SETTINGS.social_posts_per_cycle,
    1,
    30,
    DEFAULT_AUTOMATION_SETTINGS.social_posts_per_cycle
  );
  const cycleWeeks = normalizeInteger(
    settings?.social_cycle_weeks ?? 1,
    1,
    12,
    DEFAULT_AUTOMATION_SETTINGS.social_cycle_weeks
  );

  return {
    postsPerCycle,
    cycleWeeks
  };
}

export function getReviewAutomationMode(settings?: Partial<MerchantAutomationSettingsRow> | null) {
  return getConfiguredAutomationMode(settings);
}

export function getReviewAutomationSummary(settings?: Partial<MerchantAutomationSettingsRow> | null) {
  return getAutomationSummary(settings);
}

function normalizeKeywords(value?: string[] | string | null) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [...DEFAULT_SENSITIVE_KEYWORDS];

  return list.map((item) => item.trim().toLowerCase()).filter(Boolean);
}

type UpsertPayload = Partial<
  Pick<
    MerchantAutomationSettingsRow,
    | "reviews_auto_reply_enabled"
    | "review_automation_mode"
    | "reviews_five_star_action"
    | "reviews_four_star_action"
    | "reviews_three_star_action"
    | "reviews_one_two_star_action"
    | "always_validate_negative_reviews"
    | "block_sensitive_reviews"
    | "sensitive_keywords"
    | "social_auto_publish_enabled"
    | "social_auto_publish_live"
    | "social_posts_per_week"
    | "social_posts_per_cycle"
    | "social_cycle_weeks"
  >
>;

export async function upsertAutomationSettings(partial: UpsertPayload, merchant?: MerchantRow | null) {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    throw new Error("Commerce introuvable.");
  }

  const supabase = await createServerSupabaseClient();
  const existing = await getAutomationSettings(currentMerchant);
  const cadence = getSocialAutomationCadence({
    ...existing,
    ...partial
  });
  const reviewAutomationMode = normalizeAutomationMode(
    partial.review_automation_mode ?? existing?.review_automation_mode ?? DEFAULT_AUTOMATION_SETTINGS.review_automation_mode
  );
  const payload = {
    merchant_id: currentMerchant.id,
    reviews_auto_reply_enabled:
      partial.reviews_auto_reply_enabled ??
      (reviewAutomationMode !== "disabled"),
    review_automation_mode: reviewAutomationMode,
    reviews_five_star_action: normalizeAutomationAction(
      partial.reviews_five_star_action ?? existing?.reviews_five_star_action,
      DEFAULT_AUTOMATION_SETTINGS.reviews_five_star_action
    ),
    reviews_four_star_action: normalizeAutomationAction(
      partial.reviews_four_star_action ?? existing?.reviews_four_star_action,
      DEFAULT_AUTOMATION_SETTINGS.reviews_four_star_action
    ),
    reviews_three_star_action: normalizeAutomationAction(
      partial.reviews_three_star_action ?? existing?.reviews_three_star_action,
      DEFAULT_AUTOMATION_SETTINGS.reviews_three_star_action
    ),
    reviews_one_two_star_action: normalizeAutomationAction(
      partial.reviews_one_two_star_action ?? existing?.reviews_one_two_star_action,
      DEFAULT_AUTOMATION_SETTINGS.reviews_one_two_star_action
    ),
    always_validate_negative_reviews:
      partial.always_validate_negative_reviews ??
      existing?.always_validate_negative_reviews ??
      DEFAULT_AUTOMATION_SETTINGS.always_validate_negative_reviews,
    block_sensitive_reviews:
      partial.block_sensitive_reviews ??
      existing?.block_sensitive_reviews ??
      DEFAULT_AUTOMATION_SETTINGS.block_sensitive_reviews,
    sensitive_keywords: normalizeKeywords(partial.sensitive_keywords ?? existing?.sensitive_keywords),
    social_auto_publish_enabled: partial.social_auto_publish_enabled ?? existing?.social_auto_publish_enabled ?? DEFAULT_AUTOMATION_SETTINGS.social_auto_publish_enabled,
    social_auto_publish_live: partial.social_auto_publish_live ?? existing?.social_auto_publish_live ?? DEFAULT_AUTOMATION_SETTINGS.social_auto_publish_live,
    social_posts_per_week: normalizeInteger(partial.social_posts_per_week ?? existing?.social_posts_per_week ?? cadence.postsPerCycle, 1, 7, DEFAULT_AUTOMATION_SETTINGS.social_posts_per_week),
    social_posts_per_cycle: Math.min(cadence.postsPerCycle, getMaxPostsForCycle(cadence.cycleWeeks)),
    social_cycle_weeks: cadence.cycleWeeks,
    updated_at: new Date().toISOString()
  };

  const { error } = existing
    ? await supabase
        .from("merchant_automation_settings")
        .update(payload)
        .eq("merchant_id", currentMerchant.id)
    : await supabase
        .from("merchant_automation_settings")
        .insert(payload);

  if (error) {
    if (!isMissingColumnError(error.message)) {
      throw new Error(error.message);
    }

    const legacyPayload = {
      merchant_id: currentMerchant.id,
      reviews_auto_reply_enabled: payload.reviews_auto_reply_enabled,
      social_auto_publish_enabled: payload.social_auto_publish_enabled,
      social_auto_publish_live: payload.social_auto_publish_live,
      social_posts_per_week: payload.social_posts_per_week,
      social_posts_per_cycle: payload.social_posts_per_cycle,
      social_cycle_weeks: payload.social_cycle_weeks,
      updated_at: payload.updated_at
    };
    const legacyResult = existing
      ? await supabase
          .from("merchant_automation_settings")
          .update(legacyPayload)
          .eq("merchant_id", currentMerchant.id)
      : await supabase
          .from("merchant_automation_settings")
          .insert(legacyPayload);

    if (legacyResult.error) {
      throw new Error(legacyResult.error.message);
    }
  }

  await saveStoredAutomationSettings(currentMerchant.id, payload);

  revalidatePath("/settings");
  revalidatePath("/automations");
  revalidatePath("/reviews");
  revalidatePath("/social");
  revalidatePath("/dashboard");

  if (payload.social_auto_publish_enabled) {
    await ensureAutomatedSocialDrafts({
      merchant: currentMerchant,
      settings: {
        ...existing,
        ...payload
      }
    });
  }

  return {
    ...existing,
    ...payload
  } satisfies Partial<MerchantAutomationSettingsRow>;
}

function isMissingColumnError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("schema cache") ||
    lower.includes("could not find") && lower.includes("column") ||
    lower.includes("column") && lower.includes("does not exist");
}

export async function updateAutomationSettings(formData: FormData) {
  "use server";

  const merchant = await getMerchant();

  if (!merchant) {
    redirect("/onboarding");
  }

  try {
    await upsertAutomationSettings({
      review_automation_mode: normalizeAutomationMode(String(formData.get("review_automation_mode") ?? "disabled")),
      reviews_five_star_action: normalizeAutomationAction(String(formData.get("reviews_five_star_action") ?? "disabled"), "disabled"),
      reviews_four_star_action: normalizeAutomationAction(String(formData.get("reviews_four_star_action") ?? "disabled"), "disabled"),
      reviews_three_star_action: normalizeAutomationAction(String(formData.get("reviews_three_star_action") ?? "disabled"), "disabled"),
      reviews_one_two_star_action: normalizeAutomationAction(String(formData.get("reviews_one_two_star_action") ?? "disabled"), "disabled"),
      always_validate_negative_reviews: formData.get("always_validate_negative_reviews") === "on",
      block_sensitive_reviews: formData.get("block_sensitive_reviews") === "on",
      sensitive_keywords: normalizeKeywords(String(formData.get("sensitive_keywords") ?? DEFAULT_SENSITIVE_KEYWORDS.join(", "))),
      social_auto_publish_enabled: formData.get("social_auto_publish_enabled") === "on",
      social_auto_publish_live: formData.get("social_auto_publish_live") === "on",
      social_posts_per_cycle: Number(formData.get("social_posts_per_cycle") ?? DEFAULT_AUTOMATION_SETTINGS.social_posts_per_cycle),
      social_cycle_weeks: Number(formData.get("social_cycle_weeks") ?? DEFAULT_AUTOMATION_SETTINGS.social_cycle_weeks)
    }, merchant);
  } catch (error) {
    redirect(`/automations?error=${encodeURIComponent(error instanceof Error ? error.message : "Impossible d’enregistrer l’automatisation.")}`);
  }

  redirect("/automations?saved=1");
}
