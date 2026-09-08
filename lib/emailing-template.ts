import { EMAIL_FONTS, normalizeEmailDesign } from "@/lib/emailing-design";
import { appendEmailFooter, sanitizeEmailHtml } from "@/lib/emailing-html";
import type { EmailCampaignRecord, EmailCampaignRecipient } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function safeHttpUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch { return ""; }
}

export function personalizeEmailText(value: string, recipient?: Pick<EmailCampaignRecipient, "firstName" | "lastName"> | null) {
  return value.replaceAll("{{first_name}}", () => recipient?.firstName || "").replaceAll("{{last_name}}", () => recipient?.lastName || "").trim();
}

export function renderEmailHtml({ campaign, merchant, recipient, origin, includeFooter = true, preserveVariables = false }: {
  campaign: Pick<EmailCampaignRecord, "id" | "merchant_id" | "content">;
  merchant: Pick<MerchantRow, "business_name" | "logo_url" | "website_url" | "city">;
  recipient?: EmailCampaignRecipient | null;
  origin?: string;
  includeFooter?: boolean;
  preserveVariables?: boolean;
}) {
  const content = campaign.content;
  const personalize = (value: string) => preserveVariables ? value : personalizeEmailText(value, recipient);
  const primary = safeColor(content.primaryColor, "#4C1D95");
  const background = safeColor(content.backgroundColor, "#F8F5FF");
  const button = safeColor(content.buttonColor, "#7C3AED");
  const base = origin ? safeHttpUrl(origin).replace(/\/$/, "") : "";
  const query = `campaign=${encodeURIComponent(campaign.id)}&recipient=${encodeURIComponent(recipient?.token ?? "")}`;
  const unsubscribeUrl = base && recipient ? `${base}/api/emailing/unsubscribe?${query}` : "";
  const trackingPixel = base && recipient ? `<img src="${escapeHtml(`${base}/api/emailing/track/open?${query}`)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : "";
  const footer = `<div style="display:block!important;padding:20px 24px;background:#f5f5f5;color:#51485f;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;text-align:center">Vous recevez cet e-mail car vous avez accepté les actualités de ${escapeHtml(merchant.business_name)}.<br>${unsubscribeUrl ? `<a href="${escapeHtml(unsubscribeUrl)}" style="display:inline!important;color:#4c1d95!important;text-decoration:underline!important">Se désabonner</a>` : "Se désabonner (lien activé lors de l’envoi)"}</div>${trackingPixel}`;

  if (content.editorMode === "html") {
    // Personal data is text, never markup, even inside an imported template.
    const html = preserveVariables ? (content.html ?? "") : (content.html ?? "")
      .replaceAll("{{first_name}}", () => escapeHtml(recipient?.firstName || ""))
      .replaceAll("{{last_name}}", () => escapeHtml(recipient?.lastName || ""))
      .replaceAll("{{unsubscribe_url}}", () => escapeHtml(unsubscribeUrl || "#"));
    const clean = sanitizeEmailHtml(html);
    const withFooter = includeFooter ? appendEmailFooter(clean, footer) : clean;
    const preheader = `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(personalize(content.preheader))}</div>`;
    return /<body\b[^>]*>/i.test(withFooter)
      ? withFooter.replace(/<body\b[^>]*>/i, (body) => `${body}${preheader}`)
      : `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>${preheader}${withFooter}</body></html>`;
  }

  const design = normalizeEmailDesign(content.design);
  const imageUrl = safeHttpUrl(content.imageUrl);
  const logoUrl = content.showLogo ? safeHttpUrl(merchant.logo_url ?? "") : "";
  const body = personalize(content.body).split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 18px;line-height:1.7;color:${design.textColor};font-size:${design.textSize}px">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
  const configuredCta = safeHttpUrl(content.ctaUrl);
  const destination = configuredCta || safeHttpUrl(merchant.website_url ?? "") || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${merchant.business_name} ${merchant.city}`)}`;
  const cta = configuredCta && base && recipient ? `${base}/api/emailing/track/click?${query}` : destination;
  const image = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Visuel de campagne" style="display:block;width:100%;max-height:340px;object-fit:cover;border-radius:${Math.min(design.radius, 18)}px">` : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;background:${background};font-family:${EMAIL_FONTS[design.font]};color:#211432">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(personalize(content.preheader))}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${background};padding:24px 8px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:${design.width}px;background:#fff;border-radius:${design.radius}px;overflow:hidden;box-shadow:0 14px 44px rgba(76,29,149,.13)">
<tr><td height="8" style="height:8px;background:${primary};background-image:linear-gradient(90deg,${primary},${button})"></td></tr>
<tr><td style="padding:24px ${design.padding}px 20px;text-align:${design.alignment}">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(merchant.business_name)}" style="max-height:56px;max-width:180px;object-fit:contain">` : `<div style="font-size:18px;font-weight:800;color:${primary}">${escapeHtml(merchant.business_name)}</div>`}</td></tr>
${image && design.imagePosition === "top" ? `<tr><td style="padding:0 ${design.padding}px">${image}</td></tr>` : ""}
<tr><td style="padding:${design.padding}px;text-align:${design.alignment}">
<h1 style="margin:0 0 22px;font-size:${design.headingSize}px;line-height:1.15;letter-spacing:-.5px;color:${primary}">${escapeHtml(personalize(content.heading))}</h1>
${image && design.imagePosition === "below_heading" ? `<div style="margin:0 0 24px">${image}</div>` : ""}${body}
${content.ctaLabel.trim() ? `<div style="padding:10px 0 28px"><a href="${escapeHtml(cta)}" style="display:inline-block;background:${button};color:#fff;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:${Math.min(design.radius, 12)}px">${escapeHtml(personalize(content.ctaLabel))}</a></div>` : ""}
<div style="border-top:1px solid #eeeaf3;padding-top:24px"><p style="margin:0;line-height:1.6;color:${design.textColor};font-size:${design.textSize}px">${escapeHtml(personalize(content.signature)).replaceAll("\n", "<br>")}</p></div>
</td></tr>${includeFooter ? `<tr><td>${footer}</td></tr>` : ""}</table></td></tr></table></body></html>`;
}
