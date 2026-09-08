import type { EmailDesign } from "@/lib/emailing-types";

export const EMAIL_FONTS = {
  arial: "Arial, Helvetica, sans-serif",
  georgia: "Georgia, Times, serif",
  verdana: "Verdana, Geneva, sans-serif"
} as const;

export const DEFAULT_EMAIL_DESIGN: EmailDesign = {
  font: "arial", textSize: 16, headingSize: 32, alignment: "left",
  width: 640, padding: 36, radius: 24, textColor: "#4B4457", imagePosition: "top"
};

function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

export function normalizeEmailDesign(value?: Partial<EmailDesign> | null): EmailDesign {
  const design = value ?? {};
  return {
    font: design.font === "georgia" || design.font === "verdana" ? design.font : "arial",
    textSize: bounded(design.textSize, 16, 12, 24),
    headingSize: bounded(design.headingSize, 32, 20, 48),
    alignment: design.alignment === "center" || design.alignment === "right" ? design.alignment : "left",
    width: bounded(design.width, 640, 480, 800),
    padding: bounded(design.padding, 36, 16, 56),
    radius: bounded(design.radius, 24, 0, 40),
    textColor: typeof design.textColor === "string" && /^#[0-9a-f]{6}$/i.test(design.textColor) ? design.textColor : DEFAULT_EMAIL_DESIGN.textColor,
    imagePosition: design.imagePosition === "below_heading" ? "below_heading" : "top"
  };
}
