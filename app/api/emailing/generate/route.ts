import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { generateEmailWithHans } from "@/lib/emailing-hans";
import { EMAIL_CAMPAIGN_TYPES, type EmailCampaignType } from "@/lib/emailing-types";
import { getMerchant } from "@/lib/merchants";
import { generateAndStoreSocialVisual } from "@/lib/social-visuals";
import { getEmailGenerationImages } from "@/lib/emailing-generation-assets";

export const maxDuration = 180;

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const payload = await request.json().catch(() => null) as { brief?: string; campaignType?: string; segmentLabel?: string } | null;
  if (!payload) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const brief = typeof payload.brief === "string" ? payload.brief.trim() : "";
  if (!brief) return NextResponse.json({ error: "Décrivez en une phrase ce que Hans doit préparer." }, { status: 400 });
  if (brief.length > 6000) return NextResponse.json({ error: "La demande doit rester sous 6 000 caractères." }, { status: 400 });
  if (!EMAIL_CAMPAIGN_TYPES.includes(payload.campaignType as EmailCampaignType)) return NextResponse.json({ error: "Type de campagne invalide." }, { status: 400 });
  const [brand, images] = await Promise.all([getBrandSettings(merchant), getEmailGenerationImages(merchant.id)]);
  // Use existing merchant photos first. When none exist, prepare a campaign photo
  // before composition so the model can actually integrate its real hosted URL.
  if (!images.length) {
    const visual = await generateAndStoreSocialVisual({
      merchant,
      title: brief,
      caption: brief,
      source: `Visuel éditorial pour une campagne e-mail ${payload.campaignType}. ${brief}`,
      visualPrompt: "Créer un visuel horizontal recadrable, premium, harmonieux et centré sur le produit, le service ou l’ambiance du commerce. Aucun texte intégré.",
      styleOverride: brand?.visual_style,
      format: "email", brandSettings: brand, signal: AbortSignal.timeout(65_000)
    }).catch(() => null);
    if (visual) images.push({ url: visual.imageUrl, alt: `Visuel de la campagne ${merchant.business_name}`, category: "Visuel de campagne" });
  }
  let notice = "";
  const content = await generateEmailWithHans({ merchant, brand, brief, campaignType: payload.campaignType as EmailCampaignType, segmentLabel: typeof payload.segmentLabel === "string" ? payload.segmentLabel.trim().slice(0, 300) : "Tous les clients", images, onFallback: (message) => { notice = message; } });
  return NextResponse.json({ content, notice });
}
