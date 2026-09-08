import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand-settings";
import { getMerchant } from "@/lib/merchants";
import { generateAndStoreSocialVisual } from "@/lib/social-visuals";

export const maxDuration = 120;

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });

  const payload = await request.json().catch(() => null) as { heading?: string; body?: string } | null;
  if (!payload) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const heading = (typeof payload.heading === "string" ? payload.heading.trim().slice(0, 200) : "") || "Actualité de la boutique";
  const body = (typeof payload.body === "string" ? payload.body.trim().slice(0, 6000) : "") || heading;
  try {
    const brand = await getBrandSettings(merchant);
    const visual = await generateAndStoreSocialVisual({
      merchant,
      title: heading,
      caption: body,
      source: `${heading}. ${body}`,
      visualPrompt: "Créer une image éditoriale premium, chaleureuse et facilement recadrable en bandeau horizontal. Mettre en avant l’objet réel du message sans texte ni logo intégré.",
      styleOverride: brand?.visual_style,
      format: "email", brandSettings: brand, signal: AbortSignal.any([request.signal, AbortSignal.timeout(75_000)])
    });

    return NextResponse.json({ url: visual.imageUrl });
  } catch {
    return NextResponse.json({ error: "Hans n’a pas pu générer cette image. Votre photo actuelle est conservée. Réessayez dans un instant." }, { status: 502 });
  }
}
