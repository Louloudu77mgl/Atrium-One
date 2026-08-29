export type SocialFontCategory = "Sans serif" | "Éditoriale" | "Impact" | "Manuscrite";

export type SocialFont = {
  value: string;
  label: string;
  category: SocialFontCategory;
  stack: string;
};

export const SOCIAL_FONTS: SocialFont[] = [
  { value: "Sora", label: "Sora", category: "Sans serif", stack: "var(--font-social-sora), Inter, sans-serif" },
  { value: "Inter", label: "Inter", category: "Sans serif", stack: "var(--font-social-inter), Arial, sans-serif" },
  { value: "DM Sans", label: "DM Sans", category: "Sans serif", stack: "var(--font-social-dm-sans), Inter, sans-serif" },
  { value: "Manrope", label: "Manrope", category: "Sans serif", stack: "var(--font-social-manrope), Inter, sans-serif" },
  { value: "Montserrat", label: "Montserrat", category: "Sans serif", stack: "var(--font-social-montserrat), Arial, sans-serif" },
  { value: "Poppins", label: "Poppins", category: "Sans serif", stack: "var(--font-social-poppins), Arial, sans-serif" },
  { value: "Raleway", label: "Raleway", category: "Sans serif", stack: "var(--font-social-raleway), Arial, sans-serif" },
  { value: "Work Sans", label: "Work Sans", category: "Sans serif", stack: "var(--font-social-work-sans), Arial, sans-serif" },
  { value: "Playfair Display", label: "Playfair Display", category: "Éditoriale", stack: "var(--font-social-playfair), Georgia, serif" },
  { value: "Cormorant Garamond", label: "Cormorant Garamond", category: "Éditoriale", stack: "var(--font-social-cormorant), Georgia, serif" },
  { value: "Libre Baskerville", label: "Libre Baskerville", category: "Éditoriale", stack: "var(--font-social-libre), Georgia, serif" },
  { value: "Lora", label: "Lora", category: "Éditoriale", stack: "var(--font-social-lora), Georgia, serif" },
  { value: "Merriweather", label: "Merriweather", category: "Éditoriale", stack: "var(--font-social-merriweather), Georgia, serif" },
  { value: "Georgia", label: "Georgia", category: "Éditoriale", stack: "Georgia, serif" },
  { value: "Bebas Neue", label: "Bebas Neue", category: "Impact", stack: "var(--font-social-bebas), Impact, sans-serif" },
  { value: "Oswald", label: "Oswald", category: "Impact", stack: "var(--font-social-oswald), Impact, sans-serif" },
  { value: "Anton", label: "Anton", category: "Impact", stack: "var(--font-social-anton), Impact, sans-serif" },
  { value: "Caveat", label: "Caveat", category: "Manuscrite", stack: "var(--font-social-caveat), cursive" },
  { value: "Dancing Script", label: "Dancing Script", category: "Manuscrite", stack: "var(--font-social-dancing), cursive" },
  { value: "Pacifico", label: "Pacifico", category: "Manuscrite", stack: "var(--font-social-pacifico), cursive" },
  { value: "Trebuchet MS", label: "Trebuchet MS", category: "Sans serif", stack: "'Trebuchet MS', sans-serif" },
  { value: "Helvetica Neue", label: "Helvetica Neue", category: "Sans serif", stack: "'Helvetica Neue', Arial, sans-serif" }
];

export const SOCIAL_FONT_VALUES = SOCIAL_FONTS.map((font) => font.value);

export function getSocialFontStack(value: string) {
  return SOCIAL_FONTS.find((font) => font.value === value)?.stack ?? `${value}, Arial, sans-serif`;
}

export function resolveSocialFontStack(value: string) {
  const stack = getSocialFontStack(value);

  if (typeof window === "undefined" || !window.document.body) {
    return stack;
  }

  const bodyStyles = window.getComputedStyle(window.document.body);
  return stack.replace(/var\((--[^)]+)\)/g, (_match, variable: string) => {
    return bodyStyles.getPropertyValue(variable).trim() || "Arial";
  });
}
