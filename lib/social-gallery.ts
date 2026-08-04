import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MerchantMediaAssetRow, MerchantRow } from "@/lib/supabase/types";

export async function getMerchantMediaAssets(merchant?: MerchantRow | null): Promise<MerchantMediaAssetRow[]> {
  const currentMerchant = merchant ?? await getMerchant();

  if (!currentMerchant) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("merchant_media_assets")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      return [];
    }

    throw new Error(error.message);
  }

  return data;
}

export function buildAutomaticAltText({
  merchantName,
  businessType,
  category,
  filename,
  context
}: {
  merchantName?: string | null;
  businessType?: string | null;
  category?: string | null;
  filename?: string | null;
  context?: string | null;
}) {
  const label = [category, context, filename?.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ")].filter(Boolean)[0];
  const scope = [businessType, merchantName].filter(Boolean).join(" · ");
  return [label ? `Photo du commerce : ${label}` : "Photo du commerce", scope].filter(Boolean).join(" — ");
}

export function extractImageCandidatesFromHtml(html: string, baseUrl: URL) {
  const matches = Array.from(html.matchAll(/<(?:img|meta)[^>]+(?:src|content)=["']([^"']+)["']/gi));
  const urls = matches
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .map((value) => toAbsoluteUrl(value!, baseUrl))
    .filter((value): value is string => Boolean(value))
    .filter((value) => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(value))
    .slice(0, 96);

  return Array.from(new Set(urls));
}

function toAbsoluteUrl(value: string, baseUrl: URL) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}
