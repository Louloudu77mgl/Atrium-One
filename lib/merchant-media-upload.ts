import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAutomaticAltText } from "@/lib/social-gallery";
import {
  MERCHANT_MEDIA_ALLOWED_MIME_TYPES,
  MERCHANT_MEDIA_BUCKET,
  MERCHANT_MEDIA_MAX_BYTES,
  resolveMerchantAssetUrl
} from "@/lib/merchant-media";
import type { Database, MerchantMediaAssetRow, MerchantRow } from "@/lib/supabase/types";

const MAX_PIXELS = 40_000_000;

export async function uploadMerchantMedia({
  client,
  merchant,
  file,
  categoryId,
  altText
}: {
  client: SupabaseClient<Database>;
  merchant: MerchantRow;
  file: File;
  categoryId: string;
  altText?: string | null;
}) {
  if (!MERCHANT_MEDIA_ALLOWED_MIME_TYPES.includes(file.type as (typeof MERCHANT_MEDIA_ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Format invalide. Utilisez une image JPG, PNG ou WebP.");
  }
  if (file.size <= 0 || file.size > MERCHANT_MEDIA_MAX_BYTES) {
    throw new Error("Chaque image doit peser au maximum 12 Mo.");
  }

  const { data: category, error: categoryError } = await client
    .from("merchant_media_categories")
    .select("id,name")
    .eq("id", categoryId)
    .eq("merchant_id", merchant.id)
    .single();
  if (categoryError || !category) throw new Error("Catégorie introuvable pour ce commerce.");

  const input = Buffer.from(await file.arrayBuffer());
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { failOn: "warning" }).metadata();
  } catch {
    throw new Error("Le fichier ne contient pas une image valide.");
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) {
    throw new Error("La résolution de cette image est trop élevée.");
  }

  const safeImage = await sharp(input, { failOn: "warning" })
    .rotate()
    .resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 })
    .toBuffer();
  const storagePath = `${merchant.id}/${new Date().getUTCFullYear()}/${randomUUID()}.webp`;
  const { error: uploadError } = await client.storage.from(MERCHANT_MEDIA_BUCKET).upload(storagePath, safeImage, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false
  });
  if (uploadError) throw new Error(uploadError.message);

  const automaticAlt = buildAutomaticAltText({
    merchantName: merchant.business_name,
    businessType: merchant.business_type,
    category: category.name,
    filename: file.name
  });
  const { data: asset, error: insertError } = await client
    .from("merchant_media_assets")
    .insert({
      merchant_id: merchant.id,
      url: `storage://${MERCHANT_MEDIA_BUCKET}/${storagePath}`,
      storage_path: storagePath,
      original_filename: file.name.slice(0, 180),
      mime_type: "image/webp",
      byte_size: safeImage.byteLength,
      alt_text: altText?.trim().slice(0, 500) || automaticAlt,
      category: category.name,
      category_id: category.id,
      source: "upload"
    })
    .select("*")
    .single();

  if (insertError || !asset) {
    await client.storage.from(MERCHANT_MEDIA_BUCKET).remove([storagePath]);
    throw new Error(insertError?.message ?? "La photo n’a pas pu être enregistrée.");
  }

  return hydrateUploadedAsset(asset, category.name, client);
}

async function hydrateUploadedAsset(asset: MerchantMediaAssetRow, categoryName: string, client: SupabaseClient<Database>) {
  return {
    ...asset,
    category_name: categoryName,
    signed_url: await resolveMerchantAssetUrl(asset, client)
  };
}
