import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { generateEmailWithHans } from "@/lib/emailing-hans";
import { EMAIL_CAMPAIGN_TYPES, type EmailCampaignType } from "@/lib/emailing-types";
import { getMerchant } from "@/lib/merchants";
import { generateAndStoreSocialVisual } from "@/lib/social-visuals";

export const maxDuration = 120;

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const payload = await request.json() as { brief?: string; campaignType?: string; segmentLabel?: string };
  const brief = payload.brief?.trim() ?? "";
  if (!brief) return NextResponse.json({ error: "Décrivez en une phrase ce que Hans doit préparer." }, { status: 400 });
  if (!EMAIL_CAMPAIGN_TYPES.includes(payload.campaignType as EmailCampaignType)) return NextResponse.json({ error: "Type de campagne invalide." }, { status: 400 });
  const brand = await getBrandSettings(merchant);
  const [content, visual] = await Promise.all([
    generateEmailWithHans({
      merchant,
      brand,
      brief,
      campaignType: payload.campaignType as EmailCampaignType,
      segmentLabel: payload.segmentLabel?.trim() || "Tous les clients"
    }),
    generateAndStoreSocialVisual({
      merchant,
      title: brief,
      caption: brief,
      source: `Visuel éditorial pour une campagne e-mail ${payload.campaignType}. ${brief}`,
      visualPrompt: "Créer un visuel horizontal recadrable, premium, harmonieux et centré sur le produit, le service ou l’ambiance du commerce. Aucun texte intégré.",
      styleOverride: brand?.visual_style
    }).catch(() => null)
  ]);
  return NextResponse.json({ content: { ...content, imageUrl: visual?.imageUrl ?? content.imageUrl } });
}
