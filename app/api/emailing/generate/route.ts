import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { generateEmailWithHans } from "@/lib/emailing-hans";
import { EMAIL_CAMPAIGN_TYPES, type EmailCampaignType } from "@/lib/emailing-types";
import { getMerchant } from "@/lib/merchants";
import { generateAndStoreSocialVisual } from "@/lib/social-visuals";
import { EmailGenerationError, emailHttpUrl } from "@/lib/emailing-generation";

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
  let stage: "image" | "email" = "image";
  try {
    const brand = await getBrandSettings(merchant);
    // Every new campaign gets a freshly generated hero. The gallery is deliberately
    // not consulted: no stock photo or previous campaign can silently replace it.
    const visual = await generateAndStoreSocialVisual({
      merchant,
      title: `Campagne ${payload.campaignType} — ${merchant.business_name}`,
      caption: brief,
      source: brief,
      visualPrompt: "Interpréter le brief pour illustrer son sujet commercial. Générer une photographie originale horizontale pour cette campagne, centrée sur le produit, le service ou l’ambiance demandés. Ne pas représenter la demande de rédaction, une interface, une newsletter ou une affiche. Aucun texte intégré.",
      styleOverride: brand?.visual_style,
      format: "email", brandSettings: brand, signal: AbortSignal.any([request.signal, AbortSignal.timeout(75_000)])
    });
    if (!emailHttpUrl(visual?.imageUrl)) throw new Error("Visuel généré indisponible.");
    const images = [{ url: visual.imageUrl, alt: `Illustration de campagne pour ${merchant.business_name}`, category: "Visuel généré par Hans pour cette campagne" }];
    stage = "email";
    const content = await generateEmailWithHans({ merchant, brand, brief, campaignType: payload.campaignType as EmailCampaignType, segmentLabel: typeof payload.segmentLabel === "string" ? payload.segmentLabel.trim().slice(0, 300) : "Tous les clients", images, signal: request.signal });
    return NextResponse.json({ content, imageSource: "generated" });
  } catch (error) {
    // Never return a successful fake generation, nor provider diagnostics/secrets.
    const code = error instanceof EmailGenerationError ? error.code : `${stage}_generation_failed`;
    console.error("[emailing/generate]", { stage, code });
    return NextResponse.json({ error: error instanceof EmailGenerationError ? error.message : stage === "image" ? "Hans n’a pas pu générer le visuel de cette campagne. Aucun email n’a été créé et aucune photo de remplacement n’a été utilisée. Relancez la génération." : "Hans n’a pas pu terminer cet email. Votre brouillon existant est conservé. Relancez la génération.", code }, { status: error instanceof EmailGenerationError && error.code === "not_configured" ? 503 : 502 });
  }
}
