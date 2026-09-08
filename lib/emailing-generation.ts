import { load } from "cheerio";
import juice from "juice";
import { sanitizeEmailHtml } from "@/lib/emailing-html";
import { emailArtDirection, emailGenerationPrompt, EMAIL_HTML_SYSTEM_PROMPT, type EmailGenerationInput } from "@/lib/emailing-generation-prompt";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function emailHttpUrl(value?: string | null) {
  try { const url = new URL(value ?? ""); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}

export function emailAllowedLinks(input: EmailGenerationInput) {
  const links = [input.content?.ctaUrl, input.business.website, ...(input.business.socials ?? []).map((item) => item.url), ...input.campaign.brief.matchAll(/https?:\/\/[^\s<>"']+/g)].map((item) => emailHttpUrl(typeof item === "string" ? item : item?.[0]?.replace(/[.,;)]+$/, ""))).filter(Boolean);
  const phone = input.business.phone?.replace(/[^\d+]/g, "");
  return [...new Set([...links, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([input.business.name, input.business.address || input.business.city].filter(Boolean).join(" "))}`, ...(phone ? [`tel:${phone}`] : []), "{{unsubscribe_url}}"] )];
}

export function emailHtmlMetadata(html: string) {
  const $ = load(html);
  const buttons = $("a[href]").filter((_, element) => Boolean(emailHttpUrl($(element).attr("href"))) && /background(?:-color)?\s*:|padding\s*:/i.test($(element).attr("style") ?? ""));
  const primary = buttons.first();
  return { subject: $("title").first().text().trim().slice(0, 80), preheader: ($('meta[name="description"]').attr("content") ?? "").slice(0, 140), heading: $("h1").first().text().slice(0, 180), body: $("p").map((_, element) => $(element).text()).get().join("\n\n").slice(0, 6000), ctaUrl: emailHttpUrl(primary.attr("href")), ctaLabel: primary.text().trim().slice(0, 60) };
}

const normalizeCopy = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Do not confuse commercial facts with instructions addressed to the writer. */
export function assertEmailBriefWasInterpreted(html: string, input: EmailGenerationInput) {
  const $ = load(html);
  $("style,script").remove();
  const published = normalizeCopy([$("body").text(), $("title").text(), $('meta[name="description"]').attr("content"), ...$("img").map((_, el) => $(el).attr("alt")).get()].join(" "));
  const brief = normalizeCopy(input.campaign.brief);
  const instructions = /\b(?:je (?:veux|voudrais|souhaite|souhaiterais)|j aimerais|(?:peux|pourrais) tu|(?:fais|fait|faire|redige|rediger|ecris|ecrire|cree|creer|genere|generer|prepare|preparer|concois|concevoir) (?:moi |nous |un |une |le |la |des |cet |cette )|mets? en avant|mettre en avant|(?:ajoute|ajouter|insere|inserer|utilise|utiliser|evite|eviter|invite|inviter|integre|integrer) |(?:il faut|tu dois|n oublie pas)|(?:ton|style|design|mise en page|objectif) (?:chaleureux|apaisant|premium|convivial|professionnel|moderne|doit)|(?:le mail|l email|la newsletter) doit)\b/g;
  for (const match of brief.matchAll(instructions)) {
    const excerpt = brief.slice(match.index).split(" ").slice(0, 8).join(" ");
    if (excerpt.split(" ").length >= 4 && published.includes(excerpt)) throw new Error("Le brief a été recopié au lieu d’être rédigé pour les clients.");
  }
  const words = brief.split(" ");
  if (words.length >= 30 && published.includes(brief)) throw new Error("Le brief complet ne doit pas apparaître dans l’email.");
}

/** Validate before storing: no guessed images/destinations, no truncated or web-only layouts. */
export function prepareGeneratedEmailHtml(raw: string, input: EmailGenerationInput) {
  if (!/^\s*<!doctype html>/i.test(raw) || !/<\/html>\s*$/i.test(raw) || !/<\/body>/i.test(raw)) throw new Error("Document HTML incomplet.");
  if (/display\s*:\s*(?:grid|(?:inline-)?flex)|position\s*:\s*(?:absolute|fixed)|@font-face|@import|<script\b|<iframe\b|<form\b/i.test(raw)) throw new Error("Mise en page non compatible e-mail.");
  const clean = sanitizeEmailHtml(raw);
  assertEmailBriefWasInterpreted(clean, input);
  const $ = load(clean);
  const links = new Set(emailAllowedLinks(input));
  const images = new Map((input.images ?? []).map((image) => [image.url, image.alt]));
  if (input.business.logo) images.set(input.business.logo, input.business.name);
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")!;
    if (!links.has(href)) throw new Error("Destination non fournie par le commerce.");
  });
  $("img").each((_, element) => {
    const image = $(element), src = image.attr("src") ?? "";
    if (!images.has(src)) throw new Error("Image non fournie par le commerce.");
    image.attr("alt", image.attr("alt")?.trim() || images.get(src) || input.business.name);
    const logo = src === input.business.logo;
    image.attr("width", logo ? "160" : image.attr("width") || "620");
    image.attr("style", `${image.attr("style") || ""};display:block;width:100%;height:auto;border:0;${logo ? "max-width:160px;" : ""}`);
    image.removeAttr("height");
  });
  // Spacer TDs otherwise create anonymous table cells in WebKit even when the
  // content TDs are display:block. Stack the entire row and its table on mobile.
  $("td.email-column").each((_, element) => {
    const row = $(element).parent("tr");
    row.addClass("atrium-stack-row").children("td,th").addClass("atrium-stack-cell");
    row.closest("table").addClass("atrium-stack-table").attr("width", "100%");
  });
  $('style#atrium-email-responsive').remove();
  $("head").append('<style id="atrium-email-responsive">@media(max-width:600px){.atrium-stack-table,.atrium-stack-table>tbody,.atrium-stack-row,.atrium-stack-cell{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}.atrium-stack-cell{padding-left:0!important;padding-right:0!important;margin-bottom:12px!important}.email-stack-gap{display:none!important}}</style>');
  const sections = $('[id^="email-"]').filter((_, el) => /^email-(?:header|hero|editorial|products|offer|visit|footer)$/.test($(el).attr("id") ?? ""));
  if ($("table").length < 3 || $("h1").length !== 1 || !$("h2").length || sections.length < 4 || !$("title").text().trim()) throw new Error("Composition de newsletter insuffisante.");
  if (!$("a[href]").toArray().some((el) => $(el).attr("href") !== "{{unsubscribe_url}}")) throw new Error("CTA manquant.");
  if ((input.images?.length ?? 0) > 0 && !$("img").toArray().some((el) => input.images?.some((image) => image.url === $(el).attr("src")))) throw new Error("Le visuel disponible n’est pas utilisé.");
  if (!/max-width:\s*(?:5[89]\d|6[0-4]\d)px/i.test(clean)) throw new Error("Container email fluide manquant.");
  // Resource loading is deliberately never enabled. Only inline CSS and media queries survive.
  const final = sanitizeEmailHtml(juice($.html(), { preserveMediaQueries: true, removeStyleTags: false, applyWidthAttributes: true, applyHeightAttributes: false }));
  if (new TextEncoder().encode(final).byteLength > 90_000) throw new Error("Email trop volumineux.");
  return /^<!doctype html>/i.test(final) ? final : `<!DOCTYPE html>\n${final}`;
}

export function fallbackEmailHtml(input: EmailGenerationInput, direction = emailArtDirection(input)) {
  const { primary, ink, titleFont, layout } = direction;
  // Saturated secondary brand colors are accents, not a full-page wash.
  const secondary = input.branding?.secondary ? `#${[1, 3, 5].map((start) => Math.round(parseInt(direction.secondary.slice(start, start + 2), 16) * 0.15 + 255 * 0.85).toString(16).padStart(2, "0")).join("")}` : direction.secondary;
  const name = escape(input.business.name), sector = escape(input.business.sector);
  const typeHeadings = { promotion: "Votre prochaine belle découverte", new_product: "Place à la nouveauté", event: "Un rendez-vous à partager", reactivation: "Et si on se retrouvait ?", loyalty: "Merci d’être à nos côtés", birthday: "Une journée qui vous ressemble", newsletter: "Le carnet de la maison", other: "Un moment à partager" };
  const title = input.content?.heading || typeHeadings[input.campaign.type];
  const subject = input.content?.subject || `${typeHeadings[input.campaign.type]} · ${input.business.name}`;
  // Offline layout fixture only, NEVER returned by live generation. Even here,
  // only explicitly approved copy is printable; no heuristic extraction of brief.
  const paragraphs = input.content?.body?.split(/\n+/).filter(Boolean).slice(0, 3) ?? [];
  const hero = input.images?.[0];
  const destination = emailAllowedLinks(input)[0];
  const label = input.content?.ctaLabel || (direction.sector === "beauty" || direction.sector === "hair" ? "Préparer ma visite" : direction.sector === "restaurant" ? "Découvrir la table" : "En savoir plus");
  const luminance = [1, 3, 5].map((start) => parseInt(primary.slice(start, start + 2), 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
  const buttonInk = luminance > 0.179 ? "#191919" : "#ffffff";
  const eyebrow = (text: string) => `<p style="margin:0 0 14px;color:${primary};font: bold 11px Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase">${escape(text)}</p>`;
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${primary}" style="border-radius:14px;background-color:${primary}"><a href="${escape(destination)}" style="display:inline-block;background-color:${primary};color:${buttonInk};padding:15px 26px;border-radius:14px;font: bold 15px Arial,Helvetica,sans-serif;text-decoration:none">${escape(label)}</a></td></tr></table>`;
  const photo = hero ? `<tr><td style="padding:0"><img src="${escape(hero.url)}" alt="${escape(hero.alt)}" width="620" style="display:block; width:100%; height:auto; border:0;"></td></tr>` : "";
  const header = `<tr><td id="email-header" class="email-padding" style="padding:32px;background-color:#ffffff;${layout === "premium" ? "text-align:center;" : ""}">${input.business.logo ? `<img src="${escape(input.business.logo)}" alt="${name}" width="160" style="display:block;width:100%;height:auto;max-width:160px;margin:0 auto 18px;">` : ""}${eyebrow(input.business.sector)}<p style="margin:0;color:${ink};font-family:${titleFont};font-size:${layout === "premium" ? 29 : 25}px;line-height:1.3">${name}</p></td></tr>`;
  const introduction = `<tr><td id="email-hero" class="email-padding" style="padding:${layout === "premium" ? "44px 36px" : "34px"};background-color:${layout === "promotion" ? secondary : "#ffffff"}">${eyebrow(input.campaign.type === "newsletter" ? "Les nouvelles de la maison" : "À découvrir")}<h1 style="margin:0 0 20px;color:${ink};font-family:${titleFont};font-size:34px;line-height:1.2;font-weight:normal">${escape(title)}</h1><p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:${ink}">Bonjour {{first_name}},</p><p style="margin:0 0 26px;font-size:16px;line-height:1.7;color:${ink}">${escape(paragraphs[0] || "Retrouvez les nouvelles de notre établissement et préparons votre prochaine visite.")}</p>${button}</td></tr>`;
  const additional = paragraphs.slice(1).map((part, index) => `<tr><td style="padding:0 0 16px"><table width="100%" role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background-color:#ffffff;padding:22px;border-radius:14px"><h3 style="margin:0 0 12px;color:${primary};font-family:${titleFont};font-size:21px;font-weight:normal">${index ? "Et aussi" : "À ne pas manquer"}</h3><p style="margin:0;font-size:15px;line-height:1.7">${escape(part)}</p></td></tr></table></td></tr>`).join("");
  const editorial = `<tr><td id="email-editorial" class="email-padding" style="padding:32px;background-color:${secondary}">${eyebrow(layout === "premium" ? "Votre prochain moment" : "Le rendez-vous")}<h2 style="margin:0 0 18px;font-family:${titleFont};font-size:26px;line-height:1.3;font-weight:normal;color:${ink}">${layout === "premium" ? "Prenez le temps de venir" : layout === "discovery" ? "On vous accueille avec plaisir" : "À retrouver chez nous"}</h2>${additional ? `<table width="100%" role="presentation" cellspacing="0" cellpadding="0" border="0">${additional}</table>` : `<p style="margin:0;font-size:16px;line-height:1.7;color:${ink}">Une question avant votre visite ? Retrouvez les informations de ${name} et échangeons sur vos envies.</p>`}</td></tr>`;
  const details = [input.business.address || input.business.city, input.business.hours].filter(Boolean).map((text) => `<p style="margin:8px 0;font-size:14px;line-height:1.7">${escape(text!)}</p>`).join("");
  const contact = `<tr><td id="email-visit" class="email-padding" style="padding:32px;background-color:#ffffff">${eyebrow("À bientôt")}<h2 style="margin:0 0 16px;font-family:${titleFont};font-size:24px;font-weight:normal">${name}</h2>${details}<a href="${escape(input.business.phone ? `tel:${input.business.phone.replace(/[^\d+]/g, "")}` : destination)}" style="font-size:14px;line-height:1.8;color:${primary};text-decoration:underline">${input.business.phone ? escape(input.business.phone) : "Préparer votre visite"}</a></td></tr>`;
  const footer = `<tr><td id="email-footer" style="padding:26px 30px;background-color:${secondary};font:12px Arial,Helvetica,sans-serif;line-height:1.8;text-align:center;color:${ink}">${name} · ${sector}${(input.business.socials ?? []).map((social) => `<br><a href="${escape(social.url)}" style="color:${primary}">${escape(social.label)}</a>`).join("")}<br><a href="{{unsubscribe_url}}" style="color:${primary};text-decoration:underline">Se désabonner</a></td></tr>`;
  const composition = layout === "premium" ? introduction + photo + editorial : layout === "promotion" ? introduction + photo + editorial : photo + introduction + editorial;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${escape(input.content?.preheader || paragraphs[0]?.slice(0, 100) || `Les nouvelles de ${input.business.name}`)}"><title>${escape(subject.slice(0, 80))}</title><style>@media(max-width:600px){.email-padding{padding:24px 20px!important}.email-column{display:block!important;width:100%!important}h1{font-size:28px!important}}</style></head><body style="margin:0;padding:0;background-color:${secondary};font-family:Arial,Helvetica,sans-serif;color:${ink}"><table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${secondary}"><tr><td align="center" style="padding:24px 8px"><table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;table-layout:fixed;background-color:#ffffff;border-radius:18px;overflow:hidden">${header}${composition}${contact}${footer}</table></td></tr></table></body></html>`;
}

export class EmailGenerationError extends Error {
  constructor(public readonly code: "not_configured" | "unavailable" | "invalid_output", message: string) {
    super(message);
    this.name = "EmailGenerationError";
  }
}

type GenerationOptions = { apiKey?: string; fetcher?: typeof fetch; signal?: AbortSignal };

export async function generateEmailHtml(input: EmailGenerationInput, options: GenerationOptions = {}): Promise<string> {
  const direction = emailArtDirection(input);
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new EmailGenerationError("not_configured", "La génération IA n’est pas configurée. Aucun email n’a été créé. Contactez l’assistance.");
  const deadline = AbortSignal.timeout(90_000);
  let correction = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: { status?: string; output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
    try {
      const signal = AbortSignal.any([deadline, AbortSignal.timeout(45_000), ...(options.signal ? [options.signal] : [])]);
      const response = await (options.fetcher ?? fetch)("https://api.openai.com/v1/responses", {
        method: "POST", signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_EMAIL_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini", instructions: EMAIL_HTML_SYSTEM_PROMPT + correction, input: emailGenerationPrompt(input, direction, emailAllowedLinks(input)), max_output_tokens: 9000, store: false, text: { format: { type: "text" } } })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result = await response.json();
    } catch {
      throw new EmailGenerationError("unavailable", "Hans n’a pas pu terminer la rédaction IA. Aucun email de remplacement n’a été créé. Réessayez dans un instant.");
    }
    try {
      if (result.status && result.status !== "completed") throw new Error("Génération interrompue : produire un document complet et plus concis.");
      const html = result.output_text || result.output?.filter((item) => item.type === "message").flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("") || "";
      return prepareGeneratedEmailHtml(html.trim(), input);
    } catch (error) {
      // One fresh attempt with validator feedback, never pasted output or a canned email.
      correction = `\nCORRECTION OBLIGATOIRE : ${error instanceof Error ? error.message : "Document invalide."} Recompose entièrement l’email à partir du brief interprété. Rédige pour les clients, jamais pour le commanditaire.`;
    }
  }
  throw new EmailGenerationError("invalid_output", "Hans n’a pas réussi à valider le texte et le design après deux tentatives. Aucun email de remplacement n’a été créé. Relancez la génération.");
}
