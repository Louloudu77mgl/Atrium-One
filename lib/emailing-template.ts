import type { EmailCampaignContent, EmailCampaignRecord, EmailCampaignRecipient } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function safeHttpUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

export function personalizeEmailText(value: string, recipient?: Pick<EmailCampaignRecipient, "firstName" | "lastName"> | null) {
  return value
    .replaceAll("{{first_name}}", recipient?.firstName || "")
    .replaceAll("{{last_name}}", recipient?.lastName || "")
    .trim();
}

export function renderEmailHtml({
  campaign,
  merchant,
  recipient,
  origin
}: {
  campaign: Pick<EmailCampaignRecord, "id" | "merchant_id" | "content">;
  merchant: MerchantRow;
  recipient?: EmailCampaignRecipient | null;
  origin?: string;
}) {
  const content: EmailCampaignContent = campaign.content;
  const primary = safeColor(content.primaryColor, "#4C1D95");
  const background = safeColor(content.backgroundColor, "#F8F5FF");
  const button = safeColor(content.buttonColor, "#7C3AED");
  const imageUrl = safeHttpUrl(content.imageUrl);
  const logoUrl = content.showLogo ? safeHttpUrl(merchant.logo_url ?? "") : "";
  const body = personalizeEmailText(content.body, recipient).split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 18px;line-height:1.7;color:#4b4457;font-size:16px">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
  const signature = personalizeEmailText(content.signature, recipient).replaceAll("\n", "<br>");
  const configuredCta = safeHttpUrl(content.ctaUrl);
  const fallbackCta = safeHttpUrl(merchant.website_url ?? "") || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${merchant.business_name} ${merchant.city}`)}`;
  const destinationCta = configuredCta || fallbackCta;
  const ctaLabel = content.ctaLabel.trim() || "Découvrir";
  const trackedCta = configuredCta && origin && recipient
    ? `${origin.replace(/\/$/, "")}/api/emailing/track/click?campaign=${encodeURIComponent(campaign.id)}&recipient=${encodeURIComponent(recipient.token)}`
    : destinationCta;
  const trackingPixel = origin && recipient
    ? `<img src="${origin.replace(/\/$/, "")}/api/emailing/track/open?campaign=${encodeURIComponent(campaign.id)}&recipient=${encodeURIComponent(recipient.token)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`
    : "";
  const unsubscribeUrl = origin && recipient
    ? `${origin.replace(/\/$/, "")}/api/emailing/unsubscribe?campaign=${encodeURIComponent(campaign.id)}&recipient=${encodeURIComponent(recipient.token)}`
    : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(content.subject)}</title></head><body style="margin:0;background:${background};font-family:Arial,sans-serif;color:#211432"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(content.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${background};padding:36px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 14px 44px rgba(76,29,149,.13)"><tr><td height="8" style="height:8px;background:${primary};background-image:linear-gradient(90deg,${primary},${button})"></td></tr><tr><td style="padding:28px 34px 20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td>${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(merchant.business_name)}" style="display:block;max-height:56px;max-width:180px;object-fit:contain">` : `<div style="font-size:18px;font-weight:800;color:${primary}">${escapeHtml(merchant.business_name)}</div>`}</td><td align="right"><span style="display:inline-block;background:${background};color:${primary};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:7px 11px;border-radius:999px">Actualité</span></td></tr></table></td></tr>${imageUrl ? `<tr><td style="padding:0 24px"><img src="${imageUrl}" alt="" style="display:block;width:100%;max-height:340px;object-fit:cover;border-radius:18px"></td></tr>` : ""}<tr><td style="padding:36px 36px 34px"><div style="width:48px;height:4px;border-radius:4px;background:${button};margin:0 0 18px"></div><h1 style="margin:0 0 22px;font-size:32px;line-height:1.15;letter-spacing:-.5px;color:${primary}">${escapeHtml(personalizeEmailText(content.heading, recipient))}</h1>${body}<div style="padding:10px 0 28px"><a href="${trackedCta}" style="display:inline-block;background:${button};color:#fff;text-decoration:none;font-weight:800;padding:15px 24px;border-radius:12px;box-shadow:0 8px 20px rgba(76,29,149,.16)">${escapeHtml(ctaLabel)}</a></div><div style="border-top:1px solid #eeeaf3;padding-top:24px"><p style="margin:0;line-height:1.6;color:#6b617f;font-size:15px">${escapeHtml(signature).replaceAll("&lt;br&gt;", "<br>")}</p></div></td></tr><tr><td style="background:${primary};padding:20px 32px;color:#fff;font-size:12px;line-height:1.6;text-align:center">Vous recevez cet e-mail car vous avez accepté les actualités de ${escapeHtml(merchant.business_name)}.${unsubscribeUrl ? `<br><a href="${unsubscribeUrl}" style="color:#fff;text-decoration:underline">Se désabonner</a>` : ""}</td></tr></table>${trackingPixel}</td></tr></table></body></html>`;
}
