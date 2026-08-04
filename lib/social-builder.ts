import type { Json, MerchantBrandSettingsRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export type SocialLayerBase = {
  id: string;
  kind: "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked?: boolean;
};

export type TextLayer = SocialLayerBase & {
  kind: "text";
  text: string;
  color: string;
  fontSize: number;
  fontWeight: number;
  align: "left" | "center" | "right";
  background?: string;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase";
};

export type ImageLayer = SocialLayerBase & {
  kind: "image";
  src: string;
  objectFit: "cover" | "contain";
  objectPositionX: number;
  objectPositionY: number;
  scale: number;
};

export type SocialLayer = TextLayer | ImageLayer;

export type SocialBuilderState = {
  version: 1;
  canvas: {
    width: number;
    height: number;
    background: string;
  };
  layers: SocialLayer[];
};

export function createInitialBuilderState({
  post,
  merchant,
  brand,
  imageUrl,
  includeVisualText = false
}: {
  post: Pick<SocialPostRow, "title" | "caption" | "cta" | "primary_color" | "secondary_color" | "accent_color" | "visual_text">;
  merchant?: MerchantRow | null;
  brand?: MerchantBrandSettingsRow | null;
  imageUrl?: string | null;
  includeVisualText?: boolean;
}): SocialBuilderState {
  const primary = post.primary_color ?? brand?.primary_color ?? "#4C1D95";
  const fallbackImage = imageUrl || "";

  return {
    version: 1,
    canvas: {
      width: 1080,
      height: 1080,
      background: primary
    },
    layers: [
      {
        id: "hero-image",
        kind: "image",
        x: 0,
        y: 0,
        width: 1080,
        height: 1080,
        rotation: 0,
        zIndex: 1,
        src: fallbackImage,
        objectFit: "cover",
        objectPositionX: 50,
        objectPositionY: 50,
        scale: 1
      },
      ...(includeVisualText && post.visual_text
        ? [
            {
              id: "visual-hook",
              kind: "text" as const,
              x: 68,
              y: 780,
              width: 760,
              height: 170,
              rotation: 0,
              zIndex: 2,
              text: post.visual_text,
              color: "#FFFFFF",
              fontSize: 64,
              fontWeight: 900,
              align: "left" as const,
              background: "rgba(33,20,50,0.18)",
              paddingX: 26,
              paddingY: 18,
              radius: 28,
              letterSpacing: -1.2
            }
          ]
        : [])
    ]
  };
}

export function parseBuilderState(raw: Json | null | undefined, fallback: SocialBuilderState): SocialBuilderState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  if (!candidate.canvas || !Array.isArray(candidate.layers)) {
    return fallback;
  }

  return {
    version: 1,
    canvas: {
      width: asNumber((candidate.canvas as Record<string, unknown>).width, fallback.canvas.width),
      height: asNumber((candidate.canvas as Record<string, unknown>).height, fallback.canvas.height),
      background: asString((candidate.canvas as Record<string, unknown>).background, fallback.canvas.background)
    },
    layers: (candidate.layers as unknown[])
      .map((layer) => normalizeLayer(layer))
      .filter((layer): layer is SocialLayer => Boolean(layer))
      .sort((left, right) => left.zIndex - right.zIndex)
  };
}

export function renderBuilderStateToHtml(state: SocialBuilderState) {
  const layersHtml = [...state.layers]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((layer) => (layer.kind === "text" ? renderTextLayer(layer) : renderImageLayer(layer)))
    .join("");

  return `<div style="position:relative;width:${state.canvas.width}px;height:${state.canvas.height}px;overflow:hidden;background:${escapeHtml(state.canvas.background)};">${layersHtml}</div>`;
}

function renderTextLayer(layer: TextLayer) {
  return `<div style="position:absolute;left:${layer.x}px;top:${layer.y}px;width:${layer.width}px;height:${layer.height}px;z-index:${layer.zIndex};transform:rotate(${layer.rotation}deg);display:flex;align-items:${layer.align === "center" ? "center" : "flex-start"};justify-content:${layer.align === "right" ? "flex-end" : layer.align === "center" ? "center" : "flex-start"};text-align:${layer.align};color:${escapeHtml(layer.color)};font-size:${layer.fontSize}px;font-weight:${layer.fontWeight};line-height:1.1;white-space:pre-wrap;background:${escapeHtml(layer.background ?? "transparent")};padding:${layer.paddingY ?? 0}px ${layer.paddingX ?? 0}px;border-radius:${layer.radius ?? 0}px;letter-spacing:${layer.letterSpacing ?? 0}px;text-transform:${layer.textTransform ?? "none"};box-sizing:border-box;">${escapeHtml(layer.text)}</div>`;
}

function renderImageLayer(layer: ImageLayer) {
  return `<div style="position:absolute;left:${layer.x}px;top:${layer.y}px;width:${layer.width}px;height:${layer.height}px;z-index:${layer.zIndex};transform:rotate(${layer.rotation}deg);overflow:hidden;border-radius:28px;"><img src="${escapeHtml(layer.src)}" style="width:100%;height:100%;object-fit:${layer.objectFit};object-position:${layer.objectPositionX}% ${layer.objectPositionY}%;transform:scale(${layer.scale});transform-origin:center center;" /></div>`;
}

function normalizeLayer(raw: unknown): SocialLayer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const layer = raw as Record<string, unknown>;
  const base = {
    id: asString(layer.id, `layer-${Math.random().toString(36).slice(2, 8)}`),
    kind: layer.kind === "image" ? "image" : "text",
    x: asNumber(layer.x, 0),
    y: asNumber(layer.y, 0),
    width: asNumber(layer.width, 200),
    height: asNumber(layer.height, 80),
    rotation: asNumber(layer.rotation, 0),
    zIndex: asNumber(layer.zIndex, 1),
    locked: Boolean(layer.locked)
  } as const;

  if (base.kind === "image") {
    return {
      ...base,
      kind: "image",
      src: asString(layer.src, ""),
      objectFit: layer.objectFit === "contain" ? "contain" : "cover",
      objectPositionX: asNumber(layer.objectPositionX, 50),
      objectPositionY: asNumber(layer.objectPositionY, 50),
      scale: asNumber(layer.scale, 1)
    };
  }

  return {
    ...base,
    kind: "text",
    text: asString(layer.text, ""),
    color: asString(layer.color, "#FFFFFF"),
    fontSize: asNumber(layer.fontSize, 32),
    fontWeight: asNumber(layer.fontWeight, 700),
    align: layer.align === "center" || layer.align === "right" ? layer.align : "left",
    background: typeof layer.background === "string" ? layer.background : undefined,
    paddingX: asOptionalNumber(layer.paddingX),
    paddingY: asOptionalNumber(layer.paddingY),
    radius: asOptionalNumber(layer.radius),
    letterSpacing: asOptionalNumber(layer.letterSpacing),
    textTransform: layer.textTransform === "uppercase" ? "uppercase" : "none"
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
