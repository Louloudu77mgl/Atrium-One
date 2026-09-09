import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";
import { brandPalette } from "@/lib/brand-palette";

/** Email art direction stays separate from social/poster instructions. */
export function emailImagePrompt({ merchant, brand, brief, visualPrompt }: {
  merchant: MerchantRow;
  brand: MerchantBrandSettingsRow | null;
  brief: string;
  visualPrompt?: string | null;
}) {
  return [
    "Crée une NOUVELLE photographie éditoriale horizontale premium destinée au hero d’un email marketing de commerce local.",
    "Interprète le brief comme des consignes de campagne, pas comme du texte à dessiner. Identifie le produit, le service ou l’ambiance à promouvoir et compose une scène originale à son sujet.",
    "Ne dessine jamais un email, une newsletter, un ordinateur, une interface, une affiche ou une mise en page parce que le brief demande de créer un mail.",
    "Aucun texte, titre, prix, code promo, logo, filigrane, collage ou cadre ajouté dans l’image. Le texte sera rédigé séparément dans le HTML.",
    "Photographie crédible, détails de matière, lumière naturelle soignée, un sujet principal clair, cadrage généreux adapté au mobile. Pas d’illustration générique ni de photo de banque d’images à réutiliser.",
    "Respecte les produits, objets, personnes et détails explicitement demandés. N’invente ni certification ni résultat médical, et ne prétends pas montrer les véritables locaux ou employés sans référence fournie.",
    "Le sujet commercial prime sur les préférences de style ; les consignes rédactionnelles et les CTA ne sont pas des objets à représenter.",
    `Palette complète du commerce : ${brandPalette(brand).join(", ") || "palette naturelle du secteur"}. Utilise ses couleurs dans l’ambiance et les accessoires sans recolorer artificiellement les produits.`,
    JSON.stringify({ business: { name: merchant.business_name, sector: merchant.business_type, description: merchant.description }, branding: brand ? { primary: brand.primary_color, secondary: brand.secondary_color, accent: brand.accent_color, tone: brand.tone, style: brand.visual_style } : { direction: "Palette naturelle du secteur : crème/brun/terracotta pour le pain, sauge/nude pour la beauté, couleurs de la cuisine pour la restauration. Aucun violet AtriumOne imposé." }, campaignBrief: brief.slice(0, 6000), visualDirection: visualPrompt?.slice(0, 2000) })
  ].join("\n");
}
