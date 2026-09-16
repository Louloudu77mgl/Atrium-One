import { createElement as h, type CSSProperties, type ReactNode } from "react";
import { fitEstimatedText } from "@/lib/social-editor/layout-safety";
import type { StoryEditorial, StoryLayout } from "@/lib/story-editorial";

type Box = { x: number; y: number; w: number; h: number };
function color(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
function tint(hex: string, amount: number) {
  return `#${[1, 3, 5].map((index) => Math.round(parseInt(hex.slice(index, index + 2), 16) * (1 - amount) + 255 * amount).toString(16).padStart(2, "0")).join("")}`;
}
function readable(hex: string) {
  const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? "#251E28" : "#FFFFFF";
}
function box(b: Box, style: CSSProperties, ...children: ReactNode[]) {
  return h("div", { style: { display: "flex", position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, ...style } }, ...children);
}
function copy(value: string, b: Box, size: number, min: number, style: CSSProperties = {}) {
  const clean = value.replace(/\p{Extended_Pictographic}|[\u200D\uFE0E\uFE0F]/gu, "").replace(/\s+/g, " ").trim();
  const fitted = fitEstimatedText({ text: clean, maxWidth: b.w - 16, maxHeight: b.h, maxLines: Math.floor(b.h / (min * 1.25)), maxFontSize: size, minFontSize: min, lineHeight: 1.25, fontWeight: 400 });
  if (!fitted) throw new Error("Un texte est trop long pour la Story. Raccourcissez le sujet pour préserver une mise en page lisible.");
  return box(b, { flexDirection: "column", fontSize: fitted.fontSize, lineHeight: 1.25, ...style },
    ...fitted.lines.map((line, index) => h("div", { key: index, style: { display: "flex", flexShrink: 0, height: fitted.fontSize * 1.25, whiteSpace: "nowrap" } }, line)));
}

// Template adapted from the merchant's supplied preview (6).html.
// All meaningful content stays between y=200 and y=1660 (Instagram overlays).
export function buildStoryTemplate({
  merchantName, title, cta, editorial, photo, logo, layout = "editorial", primary, secondary, accent, edition
}: {
  merchantName: string; title: string; cta: string; editorial: StoryEditorial;
  photo: string; logo?: string | null; layout?: StoryLayout;
  primary?: string | null; secondary?: string | null; accent?: string | null; edition: string;
}) {
  const ink = "#2C2430";
  const brand = color(primary, "#52415F");
  const paper = tint(color(secondary, "#E9DDCC"), .60);
  const card1 = tint(color(accent, "#9077A8"), .80);
  const card2 = tint(brand, .88);
  const photoFirst = layout === "photo-first";
  const split = layout === "split";
  const photoBox = photoFirst ? { x: 98, y: 320, w: 884, h: 410 } : split ? { x: 98, y: 682, w: 420, h: 570 } : { x: 98, y: 662, w: 884, h: 374 };
  const feature = photoFirst ? { x: 76, y: 1050, w: 928, h: 240 } : { x: 76, y: 640, w: 928, h: 650 };
  const titleY = photoFirst ? 792 : 356;
  const introY = photoFirst ? 958 : 548;
  const nodes: ReactNode[] = [
    box({ x: 76, y: 286, w: 928, h: 1 }, { background: tint(brand, .76) }),
    copy(merchantName, { x: logo ? 160 : 76, y: 212, w: logo ? 552 : 636, h: 62 }, 30, 20, { fontWeight: 700 }),
    copy(edition, { x: 760, y: 222, w: 244, h: 30 }, 18, 16, { color: "#675E68" }),
    copy(editorial.eyebrow.toLocaleUpperCase("fr-FR"), { x: 76, y: photoFirst ? 750 : 316, w: 928, h: 32 }, 20, 18, { color: ink, letterSpacing: 2 }),
    copy(title, { x: 76, y: titleY, w: 928, h: photoFirst ? 154 : 180 }, 76, 48, { fontFamily: "StoryHeading", letterSpacing: -2 }),
    copy(editorial.introduction, { x: 76, y: introY, w: 890, h: 78 }, 27, 23, { color: "#675E68" }),
    box(feature, { background: "#FFFDF9", borderRadius: 36, boxShadow: "0 12px 45px rgba(50,35,55,.07)" }),
    box(photoBox, { borderRadius: 25, overflow: "hidden" }, h("img", { src: photo, width: photoBox.w, height: photoBox.h, style: { objectFit: "cover", borderRadius: 25 } })),
    box({ x: photoBox.x + 20, y: photoBox.y + 20, w: 300, h: 48 }, { background: "#FFFDF9", borderRadius: 30 }),
    copy(editorial.photoBadge, { x: photoBox.x + 38, y: photoBox.y + 32, w: 270, h: 28 }, 18, 16, { fontWeight: 700 }),
    copy(editorial.featureTitle, { x: split ? 550 : 116, y: photoFirst ? 1080 : split ? 750 : 1072, w: split ? 412 : 848, h: 98 }, 40, 28, { fontFamily: "StoryHeading" }),
    copy(editorial.featureDescription, { x: split ? 550 : 116, y: photoFirst ? 1184 : split ? 886 : 1180, w: split ? 400 : 842, h: split ? 280 : 80 }, 24, 20, { color: "#675E68" }),
    ...editorial.blocks.slice(0, 2).flatMap((block, index) => {
      const x = 76 + index * 474;
      return [
        box({ x, y: 1316, w: 454, h: 218 }, { background: index ? card2 : card1, borderRadius: split ? 16 : 28 }),
        copy(block.label.toLocaleUpperCase("fr-FR"), { x: x + 30, y: 1344, w: 394, h: 28 }, 17, 15, { color: "#514553", letterSpacing: 1.5 }),
        copy(block.text, { x: x + 30, y: 1390, w: 394, h: 110 }, 29, 22, { fontFamily: "StoryHeading" })
      ];
    }),
    box({ x: 76, y: 1570, w: 608, h: 84 }, { background: brand, borderRadius: 50 }),
    copy(cta, { x: 110, y: 1594, w: 500, h: 38 }, 25, 20, { color: readable(brand), fontWeight: 700 }),
    copy("→", { x: 625, y: 1594, w: 36, h: 40 }, 26, 20, { color: readable(brand) }),
    copy("À bientôt", { x: 792, y: 1600, w: 212, h: 38 }, 22, 18, { color: "#675E68" })
  ];
  if (logo) nodes.push(box({ x: 76, y: 202, w: 64, h: 64 }, { background: "#FFFDF9", borderRadius: 16, overflow: "hidden" }, h("img", { src: logo, width: 64, height: 64, style: { objectFit: "contain" } })));
  return h("div", { style: { display: "flex", position: "relative", width: 1080, height: 1920, background: paper, color: ink, fontFamily: "StoryBody" } }, ...nodes);
}
