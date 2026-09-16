import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Database,
  MerchantMediaAssetRow,
  MerchantMediaCategoryRow,
  MerchantVisualPreferenceRow
} from "@/lib/supabase/types";
import { decideVisualSource, selectBestMerchantAsset, type VisualSourceMode } from "@/lib/merchant-media-selection";
export { decideVisualSource, rankMediaCategories, selectBestMerchantAsset } from "@/lib/merchant-media-selection";
export type { VisualSourceMode } from "@/lib/merchant-media-selection";

export const MERCHANT_MEDIA_BUCKET = "merchant-media";
export const MERCHANT_MEDIA_MAX_BYTES = 12 * 1024 * 1024;
export const MERCHANT_MEDIA_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type VisualSource = "ai" | "merchant" | "none";

export type MerchantMediaAsset = MerchantMediaAssetRow & {
  signed_url: string;
  category_name: string | null;
};

export type MerchantMediaLibrary = {
  categories: MerchantMediaCategoryRow[];
  assets: MerchantMediaAsset[];
  preference: MerchantVisualPreferenceRow;
};

function defaultPreference(merchantId: string): MerchantVisualPreferenceRow {
  const now = new Date().toISOString();
  return {
    merchant_id: merchantId,
    image_source_mode: "ai",
    next_mixed_source: "merchant",
    sequence_version: 0,
    created_at: now,
    updated_at: now
  };
}

function isMissingMediaSchema(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "PGRST205" || error?.code === "42P01" || message.includes("schema cache") || message.includes("Could not find") || message.includes("does not exist");
}

export async function getMerchantMediaLibrary(
  merchantId: string,
  suppliedClient?: SupabaseClient<Database>
): Promise<MerchantMediaLibrary> {
  const supabase = suppliedClient ?? await createServerSupabaseClient();
  const [categoriesResult, assetsResult, preferenceResult] = await Promise.all([
    supabase.from("merchant_media_categories").select("*").eq("merchant_id", merchantId).order("sort_order").order("name"),
    supabase.from("merchant_media_assets").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
    supabase.from("merchant_visual_preferences").select("*").eq("merchant_id", merchantId).maybeSingle()
  ]);

  const firstError = categoriesResult.error ?? assetsResult.error ?? preferenceResult.error;
  if (firstError) {
    if (isMissingMediaSchema(firstError)) {
      return { categories: [], assets: [], preference: defaultPreference(merchantId) };
    }
    throw new Error(firstError.message);
  }

  const categories = categoriesResult.data ?? [];
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const assets = await Promise.all((assetsResult.data ?? []).map(async (asset) => ({
    ...asset,
    signed_url: await resolveMerchantAssetUrl(asset, supabase),
    category_name: asset.category_id ? categoryNames.get(asset.category_id) ?? asset.category : asset.category
  })));

  return {
    categories,
    assets,
    preference: preferenceResult.data ?? defaultPreference(merchantId)
  };
}

export async function getMerchantMediaCategories(
  merchantId: string,
  suppliedClient?: SupabaseClient<Database>
) {
  const supabase = suppliedClient ?? await createServerSupabaseClient();
  const { data, error } = await supabase.from("merchant_media_categories").select("*").eq("merchant_id", merchantId).order("sort_order").order("name");
  if (error) {
    if (isMissingMediaSchema(error)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function resolveMerchantAssetUrl(asset: MerchantMediaAssetRow, client: SupabaseClient<Database>) {
  if (!asset.storage_path) return asset.url;
  const { data, error } = await client.storage.from(MERCHANT_MEDIA_BUCKET).createSignedUrl(asset.storage_path, 60 * 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

async function claimVisualSource({
  merchantId,
  hasMerchantAssets,
  client
}: {
  merchantId: string;
  hasMerchantAssets: boolean;
  client: SupabaseClient<Database>;
}): Promise<VisualSource> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await client.from("merchant_visual_preferences").select("*").eq("merchant_id", merchantId).maybeSingle();
    if (error) {
      if (isMissingMediaSchema(error)) return "ai";
      throw new Error(error.message);
    }
    const preference = data ?? defaultPreference(merchantId);
    if (!data) {
      const inserted = await client.from("merchant_visual_preferences").insert({ merchant_id: merchantId }).select("merchant_id").maybeSingle();
      if (inserted.error) {
        if (isMissingMediaSchema(inserted.error)) return "ai";
        if (inserted.error.code !== "23505") throw new Error(inserted.error.message);
      }
      continue;
    }
    const decision = decideVisualSource(preference.image_source_mode, preference.next_mixed_source, hasMerchantAssets);
    if (!decision.advance) return decision.source;
    const { data: claimed } = await client
      .from("merchant_visual_preferences")
      .update({
        next_mixed_source: decision.source === "merchant" ? "ai" : "merchant",
        sequence_version: preference.sequence_version + 1,
        updated_at: new Date().toISOString()
      })
      .eq("merchant_id", merchantId)
      .eq("sequence_version", preference.sequence_version)
      .select("merchant_id")
      .maybeSingle();
    if (claimed) return decision.source;
  }
  throw new Error("Impossible de réserver la prochaine source d’image. Réessayez.");
}

export async function selectMerchantVisual({
  merchantId,
  subject,
  preferredCategoryName,
  client: suppliedClient
}: {
  merchantId: string;
  subject: string;
  preferredCategoryName?: string | null;
  client?: SupabaseClient<Database>;
}): Promise<{ source: VisualSource; asset: MerchantMediaAsset | null }> {
  const client = suppliedClient ?? await createServerSupabaseClient();
  const library = await getMerchantMediaLibrary(merchantId, client);
  const selected = selectBestMerchantAsset({
    subject,
    categories: library.categories,
    assets: library.assets,
    preferredCategoryName
  });
  const source = await claimVisualSource({ merchantId, hasMerchantAssets: Boolean(selected), client });
  if (source !== "merchant" || !selected) return { source, asset: null };
  const hydratedAsset = library.assets.find((asset) => asset.id === selected.id);
  if (!hydratedAsset) return { source: "none", asset: null };

  const { data: updated } = await client
    .from("merchant_media_assets")
    .update({ use_count: selected.use_count + 1, last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", selected.id)
    .eq("merchant_id", merchantId)
    .select("*")
    .single();

  return {
    source,
    asset: { ...hydratedAsset, ...(updated ?? {}), signed_url: hydratedAsset.signed_url, category_name: hydratedAsset.category_name }
  };
}
