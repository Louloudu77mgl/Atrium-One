import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectMerchantVisual } from "@/lib/merchant-media";
import { generateAndStoreSocialVisual } from "@/lib/social-visuals";
import type { Database, MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";

export type HansVisualFormat = "social" | "story" | "email" | "rcu";

export async function resolveHansVisual({
  merchant,
  title,
  caption,
  visualPrompt,
  subject,
  preferredCategoryName,
  styleOverride,
  brandSettings,
  format,
  postId,
  supabaseClient,
  signal
}: {
  merchant: MerchantRow;
  title: string;
  caption: string;
  visualPrompt?: string | null;
  subject: string;
  preferredCategoryName?: string | null;
  styleOverride?: string | null;
  brandSettings?: MerchantBrandSettingsRow | null;
  format: HansVisualFormat;
  postId?: string | null;
  supabaseClient?: SupabaseClient<Database>;
  signal?: AbortSignal;
}) {
  const selection = await selectMerchantVisual({
    merchantId: merchant.id,
    subject: [subject, title, caption, visualPrompt].filter(Boolean).join(" · "),
    preferredCategoryName,
    client: supabaseClient
  });

  if (selection.source === "none") {
    return { imageUrl: null, imageSource: "none" as const, sourceAssetId: null, prompt: null };
  }
  if (selection.source === "merchant" && selection.asset) {
    const imageUrl = await publishMerchantAssetDerivative({
      merchantId: merchant.id,
      storageOwnerId: merchant.user_id,
      assetUrl: selection.asset.signed_url,
      format,
      postId,
      client: supabaseClient
    });
    return {
      imageUrl,
      imageSource: "merchant" as const,
      sourceAssetId: selection.asset.id,
      prompt: `Photo réelle · ${selection.asset.category_name ?? "Médiathèque"}`
    };
  }

  const generated = await generateAndStoreSocialVisual({
    merchant,
    postId,
    title,
    caption,
    visualPrompt,
    source: subject,
    styleOverride,
    brandSettings,
    format,
    supabaseClient,
    signal
  });
  return { ...generated, imageSource: "ai" as const, sourceAssetId: null };
}

async function publishMerchantAssetDerivative({
  merchantId,
  storageOwnerId,
  assetUrl,
  format,
  postId,
  client
}: {
  merchantId: string;
  storageOwnerId: string;
  assetUrl: string;
  format: HansVisualFormat;
  postId?: string | null;
  client?: SupabaseClient<Database>;
}) {
  if (!client) {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    client = await createServerSupabaseClient();
  }
  const response = await fetch(assetUrl);
  if (!response.ok) throw new Error("La photo du commerce sélectionnée est inaccessible.");
  const size = format === "story" ? { width: 1080, height: 1920 }
    : format === "email" ? { width: 1536, height: 1024 }
      : format === "rcu" ? { width: 1240, height: 1754 }
        : { width: 1080, height: 1080 };
  const image = await sharp(Buffer.from(await response.arrayBuffer()))
    .rotate()
    .resize(size.width, size.height, { fit: "cover", position: "attention" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  const path = `${storageOwnerId}/${postId ?? format}/merchant-${randomUUID()}.jpg`;
  const { error } = await client.storage.from("social-visuals").upload(path, image, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return client.storage.from("social-visuals").getPublicUrl(path).data.publicUrl;
}
