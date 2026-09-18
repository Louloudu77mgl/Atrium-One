const missingCommentLabels = new Set([
  "avis sans commentaire",
  "sans commentaire",
  "no comment",
  "no comments",
  "no written review"
]);

function normalizeLabel(value: string) {
  return value
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanGoogleReviewText(value?: string | null) {
  const text = (value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  const translatedMarker = /\(?\s*(?:translated by google|traduit par google)\s*\)?\s*[:：]?/i;
  const originalMarker = /(?:^|\n)\s*(?:\(\s*(?:original|avis d['’]origine|texte d['’]origine)\s*\)\s*[:：]?|(?:original|avis d['’]origine|texte d['’]origine)\s*[:：])\s*/i;
  const originalMatch = originalMarker.exec(text);

  // Google can put the English translation first and the French original after
  // an "Original" marker. Prefer that original block when it is available.
  if (originalMatch) {
    const original = text.slice(originalMatch.index + originalMatch[0].length);
    const translatedAfterOriginal = original.search(translatedMarker);
    return (translatedAfterOriginal >= 0 ? original.slice(0, translatedAfterOriginal) : original).trim();
  }

  const translatedMatch = translatedMarker.exec(text);
  if (!translatedMatch) return text;

  // For French reviews followed by Google's English translation, keep only the
  // French text located before the translation marker.
  const beforeTranslation = text.slice(0, translatedMatch.index).trim();
  if (beforeTranslation) return beforeTranslation;

  return text.slice(translatedMatch.index + translatedMatch[0].length).trim();
}

export function hasReviewComment(value?: string | null) {
  const cleaned = cleanGoogleReviewText(value);
  return Boolean(cleaned) && !missingCommentLabels.has(normalizeLabel(cleaned));
}

export function isNegativeRating(rating: number | null | undefined) {
  const numericRating = Number(rating);
  return Number.isFinite(numericRating) && numericRating >= 1 && numericRating <= 3;
}

export function getReviewSentimentFromRating(rating: number): "positif" | "negatif" {
  return isNegativeRating(rating) ? "negatif" : "positif";
}
