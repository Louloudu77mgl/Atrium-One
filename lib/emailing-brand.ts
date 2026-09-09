import { SOCIAL_FONTS } from "@/lib/social-fonts";

/** Literal, email-safe stacks: never CSS variables, font URLs or untrusted CSS. */
export function emailBrandFont(value?: string) {
  const font = SOCIAL_FONTS.find((item) => item.value === value);
  if (!font) return null;
  const fallback = font.category === "Éditoriale" || font.category === "Manuscrite"
    ? "Georgia, 'Times New Roman', serif"
    : "Arial, Helvetica, sans-serif";
  return { name: font.value, fallback, stack: font.value === "Georgia" ? fallback : `'${font.value}', ${fallback}` };
}
