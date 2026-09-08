import { DEFAULT_EMAIL_CONTENT, type EmailCampaignContent, type EmailCampaignType } from "@/lib/emailing-types";
import { emailHtmlMetadata, emailHttpUrl, generateEmailHtml } from "@/lib/emailing-generation";
import { emailArtDirection, type EmailGenerationInput } from "@/lib/emailing-generation-prompt";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";

/** Adapter: preserve the campaign contract while the model returns only final HTML. */
export async function generateEmailWithHans({ merchant, brand, brief, campaignType, segmentLabel, images = [], onFallback }: {
  merchant: MerchantRow;
  brand: MerchantBrandSettingsRow | null;
  brief: string;
  campaignType: EmailCampaignType;
  segmentLabel: string;
  images?: EmailGenerationInput["images"];
  onFallback?: (message: string) => void;
}): Promise<EmailCampaignContent> {
  const input: EmailGenerationInput = {
    business: { name: merchant.business_name, sector: merchant.business_type, city: merchant.city, description: merchant.description, logo: emailHttpUrl(merchant.logo_url), website: emailHttpUrl(merchant.website_url), phone: merchant.phone },
    campaign: { type: campaignType, brief: brief.slice(0, 6000), audience: segmentLabel.slice(0, 300) },
    branding: { primary: brand?.primary_color, secondary: brand?.secondary_color, accent: brand?.accent_color, tone: brand?.tone || merchant.response_tone, style: brand?.visual_style },
    images: images.filter((image) => emailHttpUrl(image.url)).slice(0, 6),
    variant: Math.floor(Math.random() * 3)
  };
  const html = await generateEmailHtml(input, { onFallback });
  const meta = emailHtmlMetadata(html), direction = emailArtDirection(input);
  return { ...DEFAULT_EMAIL_CONTENT, ...meta, editorMode: "html", html, htmlFileName: "", imageUrl: images[0]?.url ?? "", primaryColor: direction.primary, backgroundColor: direction.secondary, buttonColor: direction.primary, signature: `À bientôt,\nL’équipe ${merchant.business_name}` };
}
