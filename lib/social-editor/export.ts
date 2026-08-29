import type { DesignElement, EditorFormat, ExportSettings, ImageDesignElement, InstagramDesignDocument, ShapeDesignElement, TextDesignElement } from "./types";
import { FORMAT_DIMENSIONS } from "./document";
import { validateDesignDocumentLayout } from "./layout-safety";
import { resolveSocialFontStack } from "@/lib/social-fonts";

type RenderExportOptions = {
  scale?: number;
  transparentBackground?: boolean;
};

export async function renderDocumentToDataUrl(
  designDocument: InstagramDesignDocument,
  settings: ExportSettings,
  options: RenderExportOptions = {}
) {
  const dimensions = FORMAT_DIMENSIONS[designDocument.format];
  const layoutErrors = validateDesignDocumentLayout(designDocument);

  if (layoutErrors.length > 0) {
    throw new Error(`Export bloqué pour éviter un texte tronqué : ${layoutErrors[0]}`);
  }

  await Promise.all(
    [...new Set(designDocument.elements.filter((element): element is TextDesignElement => element.type === "text").map((element) => element.fontFamily))]
      .map((fontFamily) => window.document.fonts.load(`700 32px ${resolveSocialFontStack(fontFamily)}`).catch(() => []))
  );

  const scale = options.scale ?? 1;
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.round(dimensions.width * scale);
  canvas.height = Math.round(dimensions.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas indisponible pour l’export.");
  }

  context.scale(scale, scale);

  if (!settings.transparentBackground) {
    context.fillStyle = designDocument.backgroundColor;
    context.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  if (designDocument.backgroundImage) {
    await drawImageElement(context, {
      id: "background",
      type: "image",
      name: "Arrière-plan",
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: true,
      zIndex: 0,
      src: designDocument.backgroundImage,
      fit: "cover",
      cropX: 50,
      cropY: 50,
      scale: 1,
      borderRadius: 0,
      shadow: false
    });
  }

  for (const element of designDocument.elements.slice().sort((left, right) => left.zIndex - right.zIndex)) {
    if (!element.visible) {
      continue;
    }

    if (element.type === "text") {
      drawTextElement(context, element);
    } else if (element.type === "shape") {
      drawShapeElement(context, element);
    } else {
      await drawImageElement(context, element);
    }
  }

  if (settings.format === "jpeg") {
    return canvas.toDataURL("image/jpeg", settings.jpegQuality);
  }

  return canvas.toDataURL("image/png");
}

export function getExportFileName(title: string, extension: "png" | "jpeg") {
  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `atriumone-${slug || "post-instagram"}.${extension === "jpeg" ? "jpg" : "png"}`;
}

export function getFormatLabel(format: EditorFormat) {
  return FORMAT_DIMENSIONS[format].label;
}

function drawTextElement(context: CanvasRenderingContext2D, element: TextDesignElement) {
  context.save();
  context.translate(element.x + element.width / 2, element.y + element.height / 2);
  context.rotate((element.rotation * Math.PI) / 180);
  context.globalAlpha = element.opacity;

  if (element.backgroundColor) {
    drawRoundedRect(context, -element.width / 2, -element.height / 2, element.width, element.height, 18);
    context.fillStyle = element.backgroundColor;
    context.fill();
  }

  context.fillStyle = element.color;
  context.textAlign = element.align;
  context.textBaseline = "top";

  const fittedText = fitCanvasText(context, element);
  context.font = getCanvasFont(element, fittedText.fontSize);
  const lines = fittedText.lines;
  const startX = element.align === "left" ? -element.width / 2 : element.align === "center" ? 0 : element.width / 2;
  let cursorY = -element.height / 2;

  for (const line of lines) {
    context.fillText(line, startX, cursorY);
    if (element.underline) {
      const metrics = context.measureText(line);
      const underlineX = element.align === "center" ? -metrics.width / 2 : element.align === "right" ? -metrics.width : 0;
      context.fillRect(startX + underlineX, cursorY + fittedText.fontSize + 6, metrics.width, 2);
    }
    cursorY += fittedText.fontSize * element.lineHeight;
  }

  context.restore();
}

function drawShapeElement(context: CanvasRenderingContext2D, element: ShapeDesignElement) {
  context.save();
  context.translate(element.x + element.width / 2, element.y + element.height / 2);
  context.rotate((element.rotation * Math.PI) / 180);
  context.globalAlpha = element.opacity;

  if (element.shadow) {
    context.shadowColor = "rgba(76,29,149,0.18)";
    context.shadowBlur = 20;
    context.shadowOffsetY = 8;
  }

  const left = -element.width / 2;
  const top = -element.height / 2;

  context.fillStyle = element.fill;
  context.strokeStyle = element.borderColor;
  context.lineWidth = element.borderWidth;

  if (element.shape === "circle") {
    context.beginPath();
    context.ellipse(0, 0, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
  } else if (element.shape === "line" || element.shape === "divider") {
    context.beginPath();
    context.moveTo(left, 0);
    context.lineTo(left + element.width, 0);
  } else {
    drawRoundedRect(context, left, top, element.width, element.height, element.borderRadius);
  }

  if (element.fill !== "transparent") {
    context.fill();
  }
  if (element.borderWidth > 0) {
    context.stroke();
  }

  context.restore();
}

async function drawImageElement(context: CanvasRenderingContext2D, element: ImageDesignElement) {
  const image = await loadImage(element.src);
  context.save();
  context.translate(element.x + element.width / 2, element.y + element.height / 2);
  context.rotate((element.rotation * Math.PI) / 180);
  context.globalAlpha = element.opacity;

  if (element.shadow) {
    context.shadowColor = "rgba(76,29,149,0.18)";
    context.shadowBlur = 24;
    context.shadowOffsetY = 10;
  }

  const left = -element.width / 2;
  const top = -element.height / 2;

  drawRoundedRect(context, left, top, element.width, element.height, element.borderRadius);
  context.clip();

  const cropX = ((element.cropX - 50) / 50) * ((element.width * element.scale - element.width) / 2);
  const cropY = ((element.cropY - 50) / 50) * ((element.height * element.scale - element.height) / 2);

  const drawWidth = element.width * element.scale;
  const drawHeight = element.height * element.scale;
  context.drawImage(image, left - cropX - (drawWidth - element.width) / 2, top - cropY - (drawHeight - element.height) / 2, drawWidth, drawHeight);
  context.restore();
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function wrapText(context: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];

  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (context.measureText(next).width > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }

    if (current) {
      lines.push(current);
    } else if (paragraph === "") {
      lines.push("");
    }
  }

  return lines.length > 0 ? lines : [text];
}

function fitCanvasText(context: CanvasRenderingContext2D, element: TextDesignElement) {
  const minFontSize = Math.max(12, Math.floor(element.fontSize * 0.58));

  for (let fontSize = element.fontSize; fontSize >= minFontSize; fontSize -= 1) {
    context.font = getCanvasFont(element, fontSize);
    const lines = wrapText(context, element.text, element.width);
    const height = lines.length * fontSize * element.lineHeight;
    const widthIsSafe = lines.every((line) => context.measureText(line).width <= element.width);

    if (height <= element.height && widthIsSafe) {
      return { fontSize, lines };
    }
  }

  throw new Error(`Le texte « ${element.name} » est trop long pour son cadre.`);
}

function getCanvasFont(element: TextDesignElement, fontSize: number) {
  return `${element.fontStyle === "italic" ? "italic " : ""}${element.fontWeight} ${fontSize}px ${resolveSocialFontStack(element.fontFamily)}`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image distante inaccessible pendant l’export."));
    image.src = src;
  });
}
