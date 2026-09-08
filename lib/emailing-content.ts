import { normalizeEmailDesign } from "@/lib/emailing-design";
import { hasEmailHtmlContent, sanitizeEmailHtml } from "@/lib/emailing-html";
import { DEFAULT_EMAIL_CONTENT, type EmailCampaignContent } from "@/lib/emailing-types";

export function normalizeEmailContent(value?: Partial<EmailCampaignContent> | null): EmailCampaignContent {
  const content = { ...DEFAULT_EMAIL_CONTENT, ...value };
  const text = (key: keyof EmailCampaignContent, max: number) => String(content[key] ?? "").trim().slice(0, max);
  return {
    subject: text("subject", 120), preheader: text("preheader", 180), heading: text("heading", 180),
    body: text("body", 6000), ctaLabel: text("ctaLabel", 60), ctaUrl: text("ctaUrl", 1000),
    signature: text("signature", 600), imageUrl: text("imageUrl", 1000), showLogo: content.showLogo !== false,
    primaryColor: text("primaryColor", 20), backgroundColor: text("backgroundColor", 20), buttonColor: text("buttonColor", 20),
    editorMode: content.editorMode === "html" ? "html" : "visual",
    html: typeof content.html === "string" ? sanitizeEmailHtml(content.html.trim()) : "",
    htmlFileName: text("htmlFileName", 180),
    design: normalizeEmailDesign(content.design)
  };
}

export function emailContentError(content: EmailCampaignContent): string | null {
  if (!content.subject.trim()) return "L’objet de l’e-mail est requis.";
  if (content.editorMode === "html") return hasEmailHtmlContent(content.html ?? "") ? null : "Importez ou saisissez un HTML contenant du texte ou une image.";
  return content.heading.trim() && content.body.trim() ? null : "Le titre et le message sont requis.";
}
