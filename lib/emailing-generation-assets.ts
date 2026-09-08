import { createServerSupabaseClient } from "@/lib/supabase/server";
import { emailHttpUrl } from "@/lib/emailing-generation";
import type { EmailGenerationInput } from "@/lib/emailing-generation-prompt";

/** Merchant-only assets; bounded query, no external scraping during email generation. */
export async function getEmailGenerationImages(merchantId: string): Promise<NonNullable<EmailGenerationInput["images"]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("merchant_media_assets").select("url,alt_text,category").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(6);
  if (error) return []; // Optional gallery, including accounts on an older schema.
  return (data ?? []).filter((image) => emailHttpUrl(image.url)).map((image) => ({ url: image.url, alt: image.alt_text || image.category || "Photo de l’établissement", category: image.category }));
}
