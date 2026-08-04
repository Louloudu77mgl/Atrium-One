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
