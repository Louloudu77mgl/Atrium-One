import sanitizeHtml from "sanitize-html";
import postcss from "postcss";

export const MAX_EMAIL_HTML_BYTES = 500_000;

// Email layout only: no executable markup, embeds, forms or CSS imports.
const cssProperties = /^(?:background(?:-color|-image|-size|-position|-repeat)?|border(?:-[a-z]+)*|box-shadow|box-sizing|color|display|float|clear|font(?:-[a-z]+)?|height|width|max-height|max-width|min-height|min-width|line-height|letter-spacing|list-style(?:-[a-z]+)?|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|opacity|overflow(?:-[xy])?|text(?:-[a-z]+)?|vertical-align|white-space|word(?:-[a-z]+)?|table-layout|object-fit|object-position|mso-[a-z-]+)$/i;

function cleanCss(source: string, inline = false) {
  try {
    const root = postcss.parse(inline ? `email{${source}}` : source, { from: undefined, map: false });
    root.walkComments((node) => { node.remove(); });
    root.walkAtRules((node) => {
      if (inline || !["media", "supports"].includes(node.name.toLowerCase()) || /[\\<>]|url\s*\(/i.test(node.params)) node.remove();
    });
    root.walkDecls((node) => {
      const value = node.value;
      const urls = [...value.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi)];
      if (!cssProperties.test(node.prop) || /[\\<>]|expression\s*\(|javascript\s*:|vbscript\s*:|@import/i.test(value)
        || urls.some((match) => !/^https?:\/\//i.test(match[2]))) node.remove();
    });
    if (!inline) return root.toString();
    const rule = root.first;
    return rule?.type === "rule" ? rule.nodes.filter((node) => node.type === "decl").map((node) => node.toString()).join(";") : "";
  } catch { return ""; }
}

export function sanitizeEmailHtml(value: string): string {
  if (new TextEncoder().encode(value).byteLength > MAX_EMAIL_HTML_BYTES) throw new Error("Le fichier HTML doit faire moins de 500 Ko.");
  const clean = sanitizeHtml(value, {
    allowedTags: ["html", "head", "body", "title", "style", "meta", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col", "div", "span", "p", "br", "hr", "a", "img", "h1", "h2", "h3", "h4", "h5", "h6", "b", "strong", "i", "em", "u", "s", "small", "sub", "sup", "ul", "ol", "li", "blockquote", "pre", "code", "center"],
    allowedAttributes: {
      "*": ["style", "class", "id", "align", "valign", "width", "height", "bgcolor", "role", "aria-label", "lang", "dir"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "border"],
      table: ["cellpadding", "cellspacing", "border"],
      td: ["colspan", "rowspan"], th: ["colspan", "rowspan", "scope"],
      meta: ["charset", { name: "name", values: ["viewport", "description"] }, "content"]
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "http", "cid"] },
    allowProtocolRelative: false,
    nestingLimit: 60,
    parseStyleAttributes: false,
    allowVulnerableTags: true, // CSS is filtered below; markup is rendered only in an isolated iframe or email.
    nonTextTags: ["script", "textarea", "option", "iframe", "object", "svg", "math"],
    transformTags: {
      "*": (tagName, attribs) => {
        if (attribs.style) attribs.style = cleanCss(attribs.style, true);
        if (tagName === "img" && attribs.src && !/^(?:https?:\/\/|cid:)/i.test(attribs.src)) delete attribs.src;
        if (tagName === "a") { attribs.target = "_blank"; attribs.rel = "noopener noreferrer"; }
        return { tagName, attribs };
      }
    }
  }).replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open: string, css: string, close: string) => `${open}${cleanCss(css)}${close}`);
  // Preserve standards mode for full documents, but never user-defined entities.
  return /^\s*<!doctype html>/i.test(value) ? `<!DOCTYPE html>\n${clean.trimStart()}` : clean;
}

export function hasEmailHtmlContent(html: string) {
  const body = html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  return /<img\b[^>]*\bsrc="(?:https?:\/\/|cid:)/i.test(body) || Boolean(sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} }).replace(/&(?:nbsp|#160);/g, " ").trim());
}

/** Add managed content inside full HTML documents as well as imported fragments. */
export function appendEmailFooter(html: string, footer: string) {
  if (/<\/body\s*>/i.test(html)) return html.replace(/<\/body\s*>/i, () => `${footer}</body>`);
  if (/<\/html\s*>/i.test(html)) return html.replace(/<\/html\s*>/i, () => `${footer}</html>`);
  return `${html}${footer}`;
}

export function isolatedEmailPreview(html: string) {
  const policy = "default-src 'none'; script-src 'none'; img-src https: http: cid:; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";
  const protection = `<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (head) => `${head}${protection}`);
  return `<!doctype html><html><head>${protection}</head><body>${html}</body></html>`;
}
