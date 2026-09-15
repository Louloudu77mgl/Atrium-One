import { emailArtDirection } from "@/lib/emailing-generation-prompt";
import { getSocialFontStack } from "@/lib/social-fonts";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";

type RcuBrandMerchant = Pick<MerchantRow, "business_name" | "business_type" | "city" | "description" | "logo_url" | "website_url" | "phone">;
type RcuBrandSettings = Pick<MerchantBrandSettingsRow, "primary_color" | "secondary_color" | "accent_color" | "social_font_family" | "tone" | "visual_style">;

/**
 * Public RCU surfaces deliberately share the same sector-aware art direction as
 * generated emails. The social font name is kept separately because the canvas
 * renderer resolves it through the font assets loaded by the app layout.
 */
export function getRcuConsumerBrand(
  merchant?: RcuBrandMerchant | null,
  brandSettings?: RcuBrandSettings | null
) {
  const direction = emailArtDirection({
    business: {
      name: merchant?.business_name?.trim() || "Votre commerce",
      sector: merchant?.business_type?.trim() || "Commerce local",
      city: merchant?.city || undefined,
      description: merchant?.description,
      logo: merchant?.logo_url,
      website: merchant?.website_url,
      phone: merchant?.phone
    },
    campaign: { type: "loyalty", brief: "Programme de fidélité en boutique" },
    branding: brandSettings ? {
      primary: brandSettings.primary_color,
      secondary: brandSettings.secondary_color,
      accent: brandSettings.accent_color,
      fontFamily: brandSettings.social_font_family,
      tone: brandSettings.tone,
      style: brandSettings.visual_style
    } : undefined,
    variant: 0
  });
  const fontName = brandSettings?.social_font_family || direction.typography?.name || "Inter";
  const titleFontName = brandSettings?.social_font_family || direction.typography?.name || (direction.titleFont.startsWith("Georgia") ? "Georgia" : fontName);

  return {
    primary: direction.primary,
    secondary: direction.secondary,
    accent: direction.accent,
    ink: direction.ink,
    surface: mixHex(direction.secondary, "#FFFFFF", 0.84),
    soft: mixHex(direction.primary, "#FFFFFF", 0.92),
    border: mixHex(direction.primary, "#FFFFFF", 0.78),
    onPrimary: readableTextColor(direction.primary),
    fontName,
    fontStack: getSocialFontStack(fontName),
    titleFontName,
    titleFontStack: getSocialFontStack(titleFontName)
  };
}

function mixHex(left: string, right: string, rightWeight: number) {
  const weight = Math.min(1, Math.max(0, rightWeight));
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);
  return `#${leftRgb.map((channel, index) => Math.round(channel * (1 - weight) + rightRgb[index] * weight).toString(16).padStart(2, "0")).join("")}`;
}

function readableTextColor(background: string) {
  const [red, green, blue] = hexToRgb(background).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 0.42 ? "#191919" : "#FFFFFF";
}

function hexToRgb(value: string) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#4C1D95";
  return [1, 3, 5].map((start) => Number.parseInt(safe.slice(start, start + 2), 16));
}
