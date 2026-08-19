const allowedTags = new Set(["p", "br", "strong", "em"]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sanitizeHansHtml(value: string) {
  const escaped = escapeHtml(value.trim());

  return escaped.replace(/&lt;(\/?)(p|br|strong|em)\s*\/?&gt;/gi, (_, closing: string, tag: string) => {
    const normalizedTag = tag.toLowerCase();

    if (!allowedTags.has(normalizedTag)) {
      return "";
    }

    if (normalizedTag === "br") {
      return "<br>";
    }

    return closing ? `</${normalizedTag}>` : `<${normalizedTag}>`;
  });
}

export function hansHtmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
