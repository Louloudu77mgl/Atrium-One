import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { getMerchant } from "@/lib/merchants";
import { generateAndStoreSocialVisual } from "@/lib/social-visuals";

export const maxDuration = 120;

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });

  const payload = await request.json() as { heading?: string; body?: string };
  const heading = payload.heading?.trim() || "Actualité de la boutique";
  const body = payload.body?.trim() || heading;
  const brand = await getBrandSettings(merchant);
  const visual = await generateAndStoreSocialVisual({
    merchant,
    title: heading,
    caption: body,
    source: `Visuel de campagne e-mail : ${heading}.`,
    visualPrompt: "Créer une image éditoriale premium, chaleureuse et facilement recadrable en bandeau horizontal. Mettre en avant l’objet réel du message sans texte ni logo intégré.",
    styleOverride: brand?.visual_style
  });

  return NextResponse.json({ url: visual.imageUrl });
}
