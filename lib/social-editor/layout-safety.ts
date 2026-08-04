import { FORMAT_DIMENSIONS } from "./document";
import type { InstagramDesignDocument, TextDesignElement } from "./types";

export type FittedTextLayout = {
  fontSize: number;
  lines: string[];
};

export function fitEstimatedText({
  text,
  maxWidth,
  maxHeight = Number.POSITIVE_INFINITY,
  maxLines,
  maxFontSize,
  minFontSize,
  lineHeight,
  fontWeight = 500
}: {
  text: string;
  maxWidth: number;
  maxHeight?: number;
  maxLines: number;
  maxFontSize: number;
  minFontSize: number;
  lineHeight: number;
  fontWeight?: number;
}): FittedTextLayout | null {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lines = wrapEstimatedText(text, maxWidth, fontSize, fontWeight);
    const renderedHeight = lines.length * fontSize * lineHeight;

    if (
      lines.length <= maxLines
      && renderedHeight <= maxHeight
      && lines.every((line) => estimateTextWidth(line, fontSize, fontWeight) <= maxWidth)
    ) {
      return { fontSize, lines };
    }
  }

  return null;
}

export function validateDesignDocumentLayout(document: InstagramDesignDocument) {
  const dimensions = FORMAT_DIMENSIONS[document.format];
  const errors: string[] = [];

  for (const element of document.elements) {
    if (!element.visible || element.type !== "text" || !element.text.trim()) {
      continue;
    }

    if (
      element.x < 0
      || element.y < 0
      || element.x + element.width > dimensions.width
      || element.y + element.height > dimensions.height
    ) {
      errors.push(`Le bloc « ${element.name} » sort du cadre.`);
      continue;
    }

    if (!fitTextElement(element)) {
      errors.push(`Le texte « ${element.name} » est trop long pour son cadre.`);
    }
  }

  return errors;
}

function fitTextElement(element: TextDesignElement) {
  const minFontSize = Math.max(12, Math.floor(element.fontSize * 0.58));
  const maxLines = Math.max(1, Math.floor(element.height / Math.max(1, minFontSize * element.lineHeight)));
  return fitEstimatedText({
    text: element.text,
    maxWidth: element.width,
    maxHeight: element.height,
    maxLines: Math.max(maxLines, 1),
    maxFontSize: element.fontSize,
    minFontSize,
    lineHeight: element.lineHeight,
    fontWeight: element.fontWeight
  });
}

function wrapEstimatedText(text: string, maxWidth: number, fontSize: number, fontWeight: number) {
  const paragraphs = text.split(/\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (currentLine && estimateTextWidth(nextLine, fontSize, fontWeight) > maxWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = nextLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    } else if (paragraph === "") {
      lines.push("");
    }
  }

  return lines.length > 0 ? lines : [text];
}

function estimateTextWidth(text: string, fontSize: number, fontWeight: number) {
  const weightFactor = fontWeight >= 700 ? 1.06 : 1;
  let units = 0;

  for (const character of text) {
    if (character === " ") units += 0.28;
    else if (/[ilI1.,'’!:;]/.test(character)) units += 0.3;
    else if (/[mwMW@%&]/.test(character)) units += 0.9;
    else if (/[A-ZÀ-ÖØ-Þ]/.test(character)) units += 0.68;
    else units += 0.56;
  }

  return units * fontSize * weightFactor;
}
