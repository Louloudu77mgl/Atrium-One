import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MediaAssetRow } from "@/lib/supabase/types";
import type { MediaCategory } from "@/lib/media-categories";
import { unsplashMediaAssets } from "@/lib/unsplash-media-assets";

export async function getMediaAssets(): Promise<MediaAssetRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      return unsplashMediaAssets;
    }

    throw new Error(error.message);
  }

  return mergeWithUnsplashAssets(data);
}

export function getMediaCategoriesForBusinessType(businessType?: string | null): MediaCategory[] {
  const normalizedType = businessType?.toLowerCase() ?? "";

  if (normalizedType.includes("restaurant") || normalizedType.includes("café") || normalizedType.includes("bar")) {
    return ["Restaurant", "Commerce alimentaire", "Produit", "Intérieur", "Équipe"];
  }

  if (normalizedType.includes("coiff")) {
    return ["Coiffure", "Beauté", "Équipe", "Client", "Intérieur"];
  }

  if (normalizedType.includes("beauté") || normalizedType.includes("beaute") || normalizedType.includes("esthétique")) {
    return ["Beauté", "Client", "Produit", "Intérieur", "Équipe"];
  }

  if (normalizedType.includes("garage") || normalizedType.includes("auto") || normalizedType.includes("mécan")) {
    return ["Garage", "Produit", "Équipe", "Extérieur", "Commerce de proximité"];
  }

  if (normalizedType.includes("sport") || normalizedType.includes("fitness")) {
    return ["Sport", "Client", "Équipe", "Intérieur", "Produit"];
  }

  if (normalizedType.includes("aliment") || normalizedType.includes("boulanger") || normalizedType.includes("épicer")) {
    return ["Commerce alimentaire", "Produit", "Équipe", "Intérieur", "Commerce de proximité"];
  }

  return ["Commerce de proximité", "Produit", "Équipe", "Intérieur", "Extérieur"];
}

export async function getSuggestedMediaAssetsForBusinessType(businessType?: string | null, context?: string | null, limit = 12): Promise<MediaAssetRow[]> {
  const assets = await getMediaAssets();
  const preferredCategories = getMediaCategoriesForBusinessType(businessType);
  const sectorKeywords = getSectorKeywords(businessType);
  const enrichedContext = [businessType, ...sectorKeywords, context].filter(Boolean).join(" ");

  return assets
    .map((asset) => ({
      asset,
      score: getAssetScore(asset, preferredCategories, enrichedContext, sectorKeywords)
    }))
    .sort((first, second) => second.score - first.score)
    .map(({ asset }) => asset)
    .slice(0, limit);
}

export async function searchMediaAssetsForPost({
  businessType,
  title,
  caption,
  angle,
  source,
  visualPrompt,
  limit = 12
}: {
  businessType?: string | null;
  title?: string | null;
  caption?: string | null;
  angle?: string | null;
  source?: string | null;
  visualPrompt?: string | null;
  limit?: number;
}) {
  const sectorKeywords = getSectorKeywords(businessType);
  const searchContext = [
    businessType,
    ...sectorKeywords,
    visualPrompt,
    title,
    caption,
    angle,
    source
  ].filter(Boolean).join(" ");

  return getSuggestedMediaAssetsForBusinessType(businessType, searchContext, limit);
}

export function getSectorKeywords(businessType?: string | null) {
  const normalizedType = businessType?.toLowerCase() ?? "";

  if (normalizedType.includes("restaurant") || normalizedType.includes("café") || normalizedType.includes("bar")) return ["restaurant", "plat", "cuisine", "salle", "menu"];
  if (normalizedType.includes("coiff")) return ["coiffure", "salon", "coupe", "cheveux", "client"];
  if (normalizedType.includes("beauté") || normalizedType.includes("beaute") || normalizedType.includes("esthétique")) return ["beauté", "soin", "cosmétique", "client", "bien-être"];
  if (normalizedType.includes("garage") || normalizedType.includes("auto") || normalizedType.includes("mécan")) return ["garage", "auto", "mécanique", "atelier", "réparation"];
  if (normalizedType.includes("sport") || normalizedType.includes("fitness")) return ["sport", "fitness", "coaching", "salle", "entraînement"];
  if (normalizedType.includes("aliment") || normalizedType.includes("boulanger") || normalizedType.includes("épicer")) return ["commerce alimentaire", "produit", "frais", "boulangerie", "épicerie"];

  return ["commerce de proximité", "boutique", "client", "produit", "local"];
}

function getAssetScore(asset: MediaAssetRow, preferredCategories: MediaCategory[], context?: string | null, sectorKeywords: string[] = []) {
  const normalizedContext = (context ?? "").toLowerCase();
  const searchable = `${asset.title} ${asset.category} ${asset.tags.join(" ")}`.toLowerCase();
  let score = 0;

  if (preferredCategories.includes(asset.category as MediaCategory)) score += 70;
  if (asset.tags.includes("featured")) score += 14;
  if (asset.uploaded_by) score += 8;
  for (const keyword of sectorKeywords) {
    if (searchable.includes(keyword)) score += 24;
  }

  const contextKeywords = extractMeaningfulKeywords(normalizedContext);

  for (const keyword of contextKeywords) {
    if (searchable.includes(keyword)) score += 8;
  }

  if (/(attente|horaire|réservation|file|accueil|client|équipe|service|sourire|humain)/.test(normalizedContext) && asset.tags.some((tag) => ["client", "équipe", "intérieur", "accueil"].includes(tag))) score += 18;
  if (/(qualité|produit|plat|fleur|pain|soin|coupe|réparation|résultat|savoir-faire|artisan)/.test(normalizedContext) && asset.tags.some((tag) => ["produit", "savoir-faire", "artisan", "qualité"].includes(tag))) score += 18;
  if (/(prix|offre|promotion|formule|menu|tarif|bon plan)/.test(normalizedContext) && asset.tags.some((tag) => ["produit", "premium", "menu"].includes(tag))) score += 14;
  if (/(visage|personne|équipe|humain|client|accueil|confiance)/.test(normalizedContext) && asset.category === "Équipe") score += 12;
  if (/(extérieur|façade|devanture|rue|local|quartier)/.test(normalizedContext) && asset.category === "Extérieur") score += 12;
  if (/(intérieur|salle|ambiance|boutique|salon|atelier)/.test(normalizedContext) && asset.category === "Intérieur") score += 12;

  return score;
}

function mergeWithUnsplashAssets(assets: MediaAssetRow[]) {
  const existingIds = new Set(assets.map((asset) => asset.id));
  const existingUrls = new Set(assets.map((asset) => asset.url));
  const fallbackAssets = unsplashMediaAssets.filter((asset) => !existingIds.has(asset.id) && !existingUrls.has(asset.url));

  return [...assets, ...fallbackAssets].sort((first, second) => {
    const featuredDelta = Number(second.tags.includes("featured")) - Number(first.tags.includes("featured"));

    if (featuredDelta !== 0) {
      return featuredDelta;
    }

    return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
  });
}

function extractMeaningfulKeywords(text: string) {
  const stopWords = new Set([
    "avec",
    "pour",
    "dans",
    "plus",
    "tout",
    "tous",
    "tres",
    "très",
    "une",
    "des",
    "les",
    "aux",
    "sur",
    "sans",
    "leur",
    "leurs",
    "cette",
    "chez",
    "vous",
    "votre",
    "notre",
    "commerce",
    "publication",
    "post",
    "visuel",
    "image"
  ]);

  return Array.from(new Set(
    text
      .split(/[^a-zàâçéèêëîïôûùüÿñæœ]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length > 3 && !stopWords.has(word))
  )).slice(0, 28);
}
