import { DEFAULT_EMAIL_CONTENT, type EmailCampaignContent, type EmailCampaignType } from "@/lib/emailing-types";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";

type OpenAIResponseBody = { output_text?: string; output?: { content?: { text?: string }[] }[] };

function extractText(body: OpenAIResponseBody) {
  return body.output_text?.trim() || body.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("").trim() || "";
}

function limit(value: unknown, max: number, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function fallbackContent(merchant: MerchantRow, brief: string, type: EmailCampaignType, brand: MerchantBrandSettingsRow | null): EmailCampaignContent {
  const objective = brief.trim() || "partager une nouveauté en boutique";
  const subjectByType: Record<EmailCampaignType, string> = {
    promotion: "Une offre rien que pour vous",
    new_product: "Une nouveauté vient d’arriver",
    event: "Réservez la date",
    reactivation: "Vous nous manquez",
    loyalty: "Merci pour votre fidélité",
    birthday: "Une surprise pour votre anniversaire",
    newsletter: `Les nouvelles de ${merchant.business_name}`,
    other: "Un message de votre boutique"
  };
  return {
    ...DEFAULT_EMAIL_CONTENT,
    subject: subjectByType[type],
    preheader: objective.slice(0, 120),
    heading: subjectByType[type],
    body: `Bonjour {{first_name}},\n\n${objective.charAt(0).toUpperCase()}${objective.slice(1)}. Hans a préparé ce message pour vous présenter l’essentiel simplement.\n\nNous serons ravis de vous accueillir prochainement.`,
    signature: `À très vite,\nL’équipe ${merchant.business_name}`,
    primaryColor: brand?.primary_color ?? DEFAULT_EMAIL_CONTENT.primaryColor,
    backgroundColor: brand?.secondary_color ?? DEFAULT_EMAIL_CONTENT.backgroundColor,
    buttonColor: brand?.accent_color ?? DEFAULT_EMAIL_CONTENT.buttonColor,
    showLogo: true
  };
}

export async function generateEmailWithHans({
  merchant,
  brand,
  brief,
  campaignType,
  segmentLabel
}: {
  merchant: MerchantRow;
  brand: MerchantBrandSettingsRow | null;
  brief: string;
  campaignType: EmailCampaignType;
  segmentLabel: string;
}) {
  const fallback = fallbackContent(merchant, brief, campaignType, brand);
  if (!process.env.OPENAI_API_KEY) return fallback;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      instructions: "Tu es Hans, responsable marketing IA d’un commerce local. Rédige un e-mail chaleureux, concret, court et immédiatement envoyable. Retourne uniquement un JSON valide avec subject, preheader, heading, body, ctaLabel, ctaUrl et signature. Utilise {{first_name}} au maximum une fois. N’invente ni remise, ni date, ni avantage absent de la demande. body doit être du texte brut avec des doubles sauts de ligne, sans HTML. Objet 55 caractères maximum, pré-header 100 caractères maximum, CTA 5 mots maximum.",
      input: JSON.stringify({
        commerce: { nom: merchant.business_name, activité: merchant.business_type, ville: merchant.city, description: merchant.description, ton: merchant.response_tone },
        identité: brand,
        type: campaignType,
        destinataires: segmentLabel,
        demande: brief
      }),
      max_output_tokens: 1000
    })
  });
  if (!response.ok) return fallback;
  try {
    const raw = JSON.parse(extractText(await response.json() as OpenAIResponseBody)) as Record<string, unknown>;
    return {
      ...fallback,
      subject: limit(raw.subject, 80, fallback.subject),
      preheader: limit(raw.preheader, 140, fallback.preheader),
      heading: limit(raw.heading, 120, fallback.heading),
      body: limit(raw.body, 3000, fallback.body),
      ctaLabel: limit(raw.ctaLabel, 40, fallback.ctaLabel),
      ctaUrl: limit(raw.ctaUrl, 500, fallback.ctaUrl),
      signature: limit(raw.signature, 300, fallback.signature)
    };
  } catch {
    return fallback;
  }
}
