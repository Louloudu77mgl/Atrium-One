import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MerchantRow } from "@/lib/supabase/types";

async function resolveMerchantLogoUrl({
  supabase,
  logoUrl
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  logoUrl?: string | null;
}) {
  if (!logoUrl) {
    return null;
  }

  const publicStorageMarker = "/storage/v1/object/public/merchant-logos/";
  if (logoUrl.includes(publicStorageMarker)) {
    const storagePath = decodeURIComponent(logoUrl.split(publicStorageMarker)[1]?.split("?")[0] ?? "");
    const signedUrl = await supabase.storage.from("merchant-logos").createSignedUrl(storagePath, 60 * 60);

    if (!signedUrl.error && signedUrl.data?.signedUrl) {
      return signedUrl.data.signedUrl;
    }
  }

  if (/^https?:\/\//i.test(logoUrl)) {
    return logoUrl;
  }

  const storagePath = logoUrl.replace(/^merchant-logos\//, "").replace(/^\/+/, "");
  const signedUrl = await supabase.storage.from("merchant-logos").createSignedUrl(storagePath, 60 * 60);

  if (!signedUrl.error && signedUrl.data?.signedUrl) {
    return signedUrl.data.signedUrl;
  }

  const { data } = supabase.storage.from("merchant-logos").getPublicUrl(storagePath);
  return data.publicUrl;
}


export async function getMerchant(userId?: string): Promise<MerchantRow | null> {
  const supabase = await createServerSupabaseClient();
  const user = userId ? { id: userId } : (await supabase.auth.getUser()).data.user;

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const logoUrl = await resolveMerchantLogoUrl({
    supabase,
    logoUrl: data?.logo_url
  });

  return data ? { ...data, logo_url: logoUrl } : data;
}
