/** Shared, serializable brand values. No arbitrary UI limit on additional colors. */
export function normalizeBrandColors(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())).map((value) => value.trim().toUpperCase()))];
}

export function brandPalette(brand: { primary_color?: string; secondary_color?: string; accent_color?: string; additional_colors?: string[] } | null | undefined) {
  return normalizeBrandColors([brand?.primary_color, brand?.secondary_color, brand?.accent_color, ...(brand?.additional_colors ?? [])]);
}
