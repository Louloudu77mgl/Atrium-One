import type { Json } from "@/lib/supabase/types";

export type EditorFormat = "square" | "portrait" | "story";

export type EditorSaveState = "saved" | "saving" | "dirty" | "error";

export type EditorSidebarTab = "templates" | "text" | "media" | "elements" | "brand" | "layers";

export type BaseDesignElement = {
  id: string;
  type: "text" | "image" | "shape" | "logo";
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
};

export type TextDesignElement = BaseDesignElement & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  underline: boolean;
  align: "left" | "center" | "right";
  color: string;
  backgroundColor: string | null;
  lineHeight: number;
  letterSpacing: number;
};

export type ImageDesignElement = BaseDesignElement & {
  type: "image" | "logo";
  src: string;
  fit: "cover" | "contain";
  cropX: number;
  cropY: number;
  scale: number;
  borderRadius: number;
  shadow: boolean;
};

export type ShapeVariant = "rectangle" | "circle" | "line" | "band" | "frame" | "pill" | "divider";

export type ShapeDesignElement = BaseDesignElement & {
  type: "shape";
  shape: ShapeVariant;
  fill: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: boolean;
};

export type DesignElement = TextDesignElement | ImageDesignElement | ShapeDesignElement;

export type InstagramDesignDocument = {
  version: 2;
  format: EditorFormat;
  postTitle: string;
  caption: string;
  hashtags: string;
  altText: string;
  backgroundColor: string;
  backgroundImage: string | null;
  safetyMargin: boolean;
  elements: DesignElement[];
};

export type HistorySnapshot = {
  document: InstagramDesignDocument;
  selectedElementId: string | null;
};

export type ExportFormat = "png" | "jpeg";

export type ExportSettings = {
  format: ExportFormat;
  jpegQuality: number;
  fileName: string;
  transparentBackground: boolean;
};

export function isEditorDocument(value: Json | null | undefined): value is InstagramDesignDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.version === 2 && typeof candidate.format === "string" && Array.isArray(candidate.elements);
}
