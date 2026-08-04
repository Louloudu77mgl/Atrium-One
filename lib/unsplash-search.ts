import { getSectorKeywords, searchMediaAssetsForPost } from "@/lib/media-assets";
import type { MediaAssetRow } from "@/lib/supabase/types";

type UnsplashPhoto = {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls?: {
    regular?: string;
    small?: string;
  };
  user?: {
    name?: string;
  };
  tags?: { title?: string }[];
};

type UnsplashSearchResponse = {
  results?: UnsplashPhoto[];
};

export async function searchUnsplashMedia({
  query,
  businessType,
  title,
  caption,
  angle,
  source,
  visualPrompt,
  limit = 12
}: {
  query?: string | null;
  businessType?: string | null;
  title?: string | null;
  caption?: string | null;
  angle?: string | null;
  source?: string | null;
  visualPrompt?: string | null;
  limit?: number;
}): Promise<MediaAssetRow[]> {
  const fallbackAssets = await searchMediaAssetsForPost({
    businessType,
    title,
    caption,
    angle,
    source,
    visualPrompt,
    limit
  });
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const searchTerms = buildSearchTerms({
    query,
    businessType,
    title,
    caption,
    angle,
    source,
    visualPrompt
  });

  if (!accessKey || !searchTerms) {
    return fallbackAssets;
  }

  try {
    const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerms)}&per_page=${Math.min(limit, 30)}&orientation=squarish&content_filter=high`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return fallbackAssets;
    }

    const body = await response.json() as UnsplashSearchResponse;
    const remoteAssets = (body.results ?? [])
      .map((photo) => toMediaAsset(photo, businessType))
      .filter((asset): asset is MediaAssetRow => Boolean(asset));

    return mergeAssets(remoteAssets, fallbackAssets).slice(0, limit);
  } catch {
    return fallbackAssets;
  }
}

function buildSearchTerms({
  query,
  businessType,
  title,
  caption,
  angle,
  source,
  visualPrompt
}: {
  query?: string | null;
  businessType?: string | null;
  title?: string | null;
  caption?: string | null;
  angle?: string | null;
  source?: string | null;
  visualPrompt?: string | null;
}) {
  const sectorKeywords = getSectorKeywords(businessType).slice(0, 3).join(" ");

  return [
    query,
    businessType,
    sectorKeywords,
    visualPrompt,
    title,
    angle,
    source,
    caption
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function toMediaAsset(photo: UnsplashPhoto, businessType?: string | null): MediaAssetRow | null {
  const url = photo.urls?.regular ?? photo.urls?.small;

  if (!url) {
    return null;
  }

  const title = photo.alt_description ?? photo.description ?? "Photo Unsplash";
  const tags = [
    "unsplash",
    ...(photo.tags ?? []).map((tag) => tag.title).filter((tag): tag is string => Boolean(tag)),
    ...getSectorKeywords(businessType)
  ];

  return {
    id: `unsplash-search-${photo.id}`,
    url,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    category: businessTypeToCategory(businessType),
    tags: Array.from(new Set(tags)),
    created_at: new Date().toISOString(),
    uploaded_by: photo.user?.name ?? null
  };
}

function businessTypeToCategory(businessType?: string | null) {
  const normalizedType = businessType?.toLowerCase() ?? "";

  if (normalizedType.includes("restaurant") || normalizedType.includes("café") || normalizedType.includes("bar")) return "Restaurant";
  if (normalizedType.includes("coiff")) return "Coiffure";
  if (normalizedType.includes("beauté") || normalizedType.includes("beaute") || normalizedType.includes("esthétique")) return "Beauté";
  if (normalizedType.includes("garage") || normalizedType.includes("auto") || normalizedType.includes("mécan")) return "Garage";
  if (normalizedType.includes("sport") || normalizedType.includes("fitness")) return "Sport";
  if (normalizedType.includes("aliment") || normalizedType.includes("boulanger") || normalizedType.includes("épicer")) return "Commerce alimentaire";

  return "Commerce de proximité";
}

function mergeAssets(primary: MediaAssetRow[], fallback: MediaAssetRow[]) {
  const seen = new Set<string>();

  return [...primary, ...fallback].filter((asset) => {
    if (seen.has(asset.url)) {
      return false;
    }

    seen.add(asset.url);
    return true;
  });
}
