"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedLogoTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

function isMissingResponseToneColumn(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("schema cache") &&
    normalizedMessage.includes("response_tone")
  );
}

function isMissingLogoUrlColumn(message: string) {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("schema cache") && normalizedMessage.includes("logo_url");
}

async function uploadMerchantLogo({
  supabase,
  userId,
  file
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  file: FormDataEntryValue | null;
}) {
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (!allowedLogoTypes.includes(file.type)) {
    throw new Error("Format logo invalide. Utilisez PNG, JPG, SVG ou WEBP.");
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Logo trop lourd. Taille maximale : 2 Mo.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${userId}/logo-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from("merchant-logos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type
    });

  if (error) {
    if (error.message.toLowerCase().includes("bucket not found")) {
      throw new Error("Bucket Supabase merchant-logos introuvable. Exécutez supabase/schema.sql puis réessayez l'upload du logo.");
    }

    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("merchant-logos").getPublicUrl(path);
  return data.publicUrl;
}

export async function createMerchant(formData: FormData) {
  if (isDemoMode()) {
    redirect("/dashboard");
  }

  if (!hasSupabaseEnv()) {
    redirect("/onboarding?error=Configuration%20Supabase%20manquante");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let logoUrl: string | null = null;

  try {
    logoUrl = await uploadMerchantLogo({
      supabase,
      userId: user.id,
      file: formData.get("logo")
    });
  } catch (logoError) {
    const message = logoError instanceof Error ? logoError.message : "Impossible d'envoyer le logo.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  const basePayload = {
    user_id: user.id,
    business_name: String(formData.get("business_name") ?? ""),
    business_type: String(formData.get("business_type") ?? ""),
    city: String(formData.get("city") ?? ""),
    phone: String(formData.get("phone") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    website_url: String(formData.get("website_url") ?? "") || null
  };
  const payload = {
    ...basePayload,
    logo_url: logoUrl,
    response_tone: "chaleureux" as const
  };

  let { error } = await supabase.from("merchants").upsert(payload, {
    onConflict: "user_id"
  });

  if (error && isMissingLogoUrlColumn(error.message) && logoUrl) {
    redirect("/onboarding?error=Colonne%20merchants.logo_url%20absente.%20Exécutez%20supabase/schema.sql%20dans%20Supabase.");
  }

  if (error && isMissingResponseToneColumn(error.message)) {
    const retry = await supabase.from("merchants").upsert({ ...basePayload, logo_url: logoUrl }, {
      onConflict: "user_id"
    });
    error = retry.error;
  }

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateMerchantProfile(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/settings?error=Configuration%20Supabase%20manquante");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const responseTone = String(formData.get("response_tone") ?? "chaleureux");
  const allowedTones = ["chaleureux", "premium", "professionnel", "convivial"];
  let logoUrl: string | null | undefined;

  try {
    logoUrl = await uploadMerchantLogo({
      supabase,
      userId: user.id,
      file: formData.get("logo")
    });
  } catch (logoError) {
    const message = logoError instanceof Error ? logoError.message : "Impossible d'envoyer le logo.";
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }

  const baseUpdate = {
    business_name: String(formData.get("business_name") ?? ""),
    business_type: String(formData.get("business_type") ?? ""),
    city: String(formData.get("city") ?? ""),
    phone: String(formData.get("phone") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    website_url: String(formData.get("website_url") ?? "") || null
  };

  const updatePayload = {
    ...baseUpdate,
    ...(logoUrl ? { logo_url: logoUrl } : {}),
    response_tone: allowedTones.includes(responseTone) ? responseTone as "chaleureux" | "premium" | "professionnel" | "convivial" : "chaleureux"
  };

  let { error } = await supabase
    .from("merchants")
    .update(updatePayload)
    .eq("user_id", user.id);

  if (error && isMissingLogoUrlColumn(error.message) && logoUrl) {
    redirect("/settings?error=Colonne%20merchants.logo_url%20absente.%20Exécutez%20supabase/schema.sql%20dans%20Supabase.");
  }

  if (error && isMissingResponseToneColumn(error.message)) {
    const retry = await supabase
      .from("merchants")
      .update({
        ...baseUpdate,
        ...(logoUrl ? { logo_url: logoUrl } : {})
      })
      .eq("user_id", user.id);
    error = retry.error;
  }

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}
