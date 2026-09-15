import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";
import { getAdminImpersonationSession } from "@/lib/crm/impersonation-session";
import { CRM_ADMIN_EMAIL } from "@/lib/crm/types";
import type { MerchantRow } from "@/lib/supabase/types";
import { cache } from "react";

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
    return logoUrl;
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


const getMerchantByUserId = cache(async (userId: string): Promise<MerchantRow | null> => {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const logoUrl = await resolveMerchantLogoUrl({
    supabase,
    logoUrl: data?.logo_url
  });

  return data ? { ...data, logo_url: logoUrl } : data;
});

const getMerchantByBusinessId = cache(async (businessId: string): Promise<MerchantRow | null> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const logoUrl = await resolveMerchantLogoUrl({ supabase, logoUrl: data?.logo_url });
  return data ? { ...data, logo_url: logoUrl } : data;
});

export async function getMerchant(userId?: string): Promise<MerchantRow | null> {
  const currentUser = await getCurrentUser();
  const impersonation = currentUser?.email?.trim().toLowerCase() === CRM_ADMIN_EMAIL
    ? await getAdminImpersonationSession()
    : null;
  if (impersonation) return getMerchantByBusinessId(impersonation.businessId);

  const resolvedUserId = userId ?? currentUser?.id;
  if (!resolvedUserId) return null;
  return getMerchantByUserId(resolvedUserId);
}
