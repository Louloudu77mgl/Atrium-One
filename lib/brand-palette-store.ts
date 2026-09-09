import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeBrandColors } from "@/lib/brand-palette";
import { SOCIAL_FONT_VALUES } from "@/lib/social-fonts";

// Reuse the existing private JSON storage. No production SQL migration required.
// Server only: callers must resolve the merchant from the authenticated session
// (settings) or a trusted internal automation, never from submitted form fields.
const BUCKET = "emailing-data";
function palettePath(merchantId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(merchantId)) throw new Error("Commerce invalide pour la charte graphique.");
  return `merchants/${merchantId}/brand-palette.json`;
}
const missing = (error: { status?: number | string; statusCode?: number | string; message?: string }) =>
  String(error.statusCode ?? error.status) === "404" || /^(?:object not found|bucket not found|the resource was not found)$/i.test(error.message ?? "");

export async function readBrandPalette(merchantId: string): Promise<{ additional_colors: string[]; font_family?: string }> {
  const path = palettePath(merchantId);
  const { data, error } = await createSupabaseAdminClient().storage.from(BUCKET).download(path);
  if (error) {
    if (missing(error)) return { additional_colors: [] };
    throw new Error("Impossible de charger la palette du commerce. Réessayez dans un instant.");
  }
  if (!data) return { additional_colors: [] };
  const value = JSON.parse(await data.text());
  if (value?.merchant_id !== merchantId || value?.version !== 1) throw new Error("Charte graphique invalide.");
  return { additional_colors: normalizeBrandColors(value.additional_colors), ...(SOCIAL_FONT_VALUES.includes(value.font_family) ? { font_family: value.font_family } : {}) };
}

export async function saveBrandPalette(merchantId: string, colors: string[], font: string) {
  const path = palettePath(merchantId), supabase = createSupabaseAdminClient();
  const bucket = await supabase.storage.getBucket(BUCKET);
  if (!bucket.data) {
    if (bucket.error && !missing(bucket.error)) throw new Error("Stockage de la charte indisponible.");
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 2 * 1024 * 1024, allowedMimeTypes: ["application/json"] });
    if (error && !/already exists/i.test(error.message)) throw new Error("Impossible de préparer le stockage de la charte.");
  } else if (bucket.data.public) throw new Error("Le stockage de la charte doit rester privé.");
  const { error } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(JSON.stringify({ version: 1, merchant_id: merchantId, additional_colors: normalizeBrandColors(colors), font_family: SOCIAL_FONT_VALUES.includes(font) ? font : "Sora" })), { contentType: "application/json", cacheControl: "0", upsert: true });
  if (error) throw new Error("Les couleurs supplémentaires et la police n’ont pas pu être sauvegardées. Réessayez.");
}
