import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";

export const DEFAULT_BRAND_SETTINGS = {
  primary_color: "#4C1D95",
  secondary_color: "#F3E8FF",
  accent_color: "#A855F7",
  social_font_family: "Sora",
  show_logo_on_social_posts: false,
  social_logo_position: "top_left",
  visual_style: "premium",
  tone: "professionnel"
} as const;

function getMissingOptionalBrandColumn(message: string) {
  const normalized = message.toLowerCase();
  const supportedColumns = ["social_font_family", "show_logo_on_social_posts", "social_logo_position"] as const;
  return supportedColumns.find((column) => normalized.includes(column) && (
    normalized.includes("schema cache") ||
    normalized.includes("column") ||
    normalized.includes("constraint")
  )) ?? null;
}

export async function getBrandSettings(merchant?: MerchantRow | null): Promise<MerchantBrandSettingsRow | null> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("merchant_brand_settings")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      return null;
    }

    throw new Error(error.message);
  }

  return data;
}

export async function updateBrandSettings(formData: FormData) {
  "use server";

  const merchant = await getMerchant();

  if (!merchant) {
    redirect("/onboarding");
  }

  const supabase = await createServerSupabaseClient();
  const visualStyle = String(formData.get("visual_style") ?? DEFAULT_BRAND_SETTINGS.visual_style);
  const tone = String(formData.get("tone") ?? DEFAULT_BRAND_SETTINGS.tone);
  const socialFontFamily = String(formData.get("social_font_family") ?? DEFAULT_BRAND_SETTINGS.social_font_family);
  const showLogoOnSocialPosts = formData.get("show_logo_on_social_posts") === "on";
  const requestedLogoPosition = String(formData.get("social_logo_position") ?? DEFAULT_BRAND_SETTINGS.social_logo_position);
  const allowedStyles = ["premium", "chaleureux", "moderne", "artisanal", "minimaliste", "dynamique"];
  const allowedTones = ["simple", "professionnel", "convivial", "haut_de_gamme"];
  const allowedFontFamilies = ["Sora", "Inter", "Georgia", "Trebuchet MS", "Helvetica Neue"];
  const allowedLogoPositions = ["top_left", "top_right", "bottom_left", "bottom_right"] as const;
  const payload = {
    merchant_id: merchant.id,
    primary_color: normalizeColor(String(formData.get("primary_color") ?? DEFAULT_BRAND_SETTINGS.primary_color)),
    secondary_color: normalizeColor(String(formData.get("secondary_color") ?? DEFAULT_BRAND_SETTINGS.secondary_color)),
    accent_color: normalizeColor(String(formData.get("accent_color") ?? DEFAULT_BRAND_SETTINGS.accent_color)),
    social_font_family: allowedFontFamilies.includes(socialFontFamily) ? socialFontFamily : DEFAULT_BRAND_SETTINGS.social_font_family,
    show_logo_on_social_posts: showLogoOnSocialPosts,
    social_logo_position: allowedLogoPositions.includes(requestedLogoPosition as typeof allowedLogoPositions[number])
      ? requestedLogoPosition as typeof allowedLogoPositions[number]
      : DEFAULT_BRAND_SETTINGS.social_logo_position,
    visual_style: allowedStyles.includes(visualStyle) ? visualStyle as MerchantBrandSettingsRow["visual_style"] : DEFAULT_BRAND_SETTINGS.visual_style,
    tone: allowedTones.includes(tone) ? tone as MerchantBrandSettingsRow["tone"] : DEFAULT_BRAND_SETTINGS.tone,
    updated_at: new Date().toISOString()
  };

  const existing = await supabase
    .from("merchant_brand_settings")
    .select("id")
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (existing.error && !existing.error.message.includes("schema cache")) {
    redirect(`/settings?error=${encodeURIComponent(existing.error.message)}`);
  }

  async function persistBrandPayload(currentPayload: typeof payload) {
    return existing.data
      ? supabase
          .from("merchant_brand_settings")
          .update(currentPayload)
          .eq("merchant_id", currentPayload.merchant_id)
      : supabase
          .from("merchant_brand_settings")
          .insert(currentPayload);
  }

  const compatiblePayload: Partial<typeof payload> = { ...payload };
  const omittedColumns: string[] = [];
  let { error } = await persistBrandPayload(payload);

  while (error) {
    const missingColumn = getMissingOptionalBrandColumn(error.message);
    if (!missingColumn || !(missingColumn in compatiblePayload)) {
      break;
    }

    omittedColumns.push(missingColumn);
    delete compatiblePayload[missingColumn];
    const retry = await persistBrandPayload(compatiblePayload as typeof payload);
    error = retry.error;
  }

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  revalidatePath("/social");
  revalidatePath("/social/create");
  const schemaWarning = omittedColumns.length > 0
    ? `&schema=${encodeURIComponent(omittedColumns.join(","))}`
    : "";
  redirect(`/settings?saved=1${schemaWarning}`);
}

function normalizeColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : DEFAULT_BRAND_SETTINGS.primary_color;
}
