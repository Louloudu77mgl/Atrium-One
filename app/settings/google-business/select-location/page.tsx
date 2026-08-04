import { redirect } from "next/navigation";
import { clearTemporaryGoogleTokens, getTemporaryGoogleTokens } from "@/lib/google-oauth";
import { connectGoogleBusinessLocation } from "@/lib/google-business-connect";
import { getGoogleConnection } from "@/lib/google-connections";
import { getGoogleBusinessLocations } from "@/lib/google-business-profile";
import { getMerchant } from "@/lib/merchants";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function selectGoogleLocation(formData: FormData) {
  "use server";

  const merchant = await getMerchant();
  const temporaryTokens = await getTemporaryGoogleTokens();
  const googleConnection = merchant ? await getGoogleConnection(merchant) : null;
  const accessToken = temporaryTokens.accessToken ?? googleConnection?.access_token_encrypted;
  const refreshToken = temporaryTokens.refreshToken ?? googleConnection?.refresh_token_encrypted ?? null;
  const email = temporaryTokens.email ?? googleConnection?.google_account_email ?? null;

  if (!merchant || !accessToken) {
    redirect("/integrations?error=Connexion%20Google%20expir%C3%A9e");
  }

  const locationId = String(formData.get("location_id") ?? "");
  const locationName = String(formData.get("location_name") ?? "");
  const scopes = String(formData.get("granted_scopes") ?? "openid,email,https://www.googleapis.com/auth/business.manage")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const result = await connectGoogleBusinessLocation({
    merchant,
    location: {
      accountName: locationId.split("/locations/")[0],
      locationId,
      locationName,
      address: null,
      status: null
    },
    accessToken,
    refreshToken,
    email,
    grantedScopes: scopes
  });

  await clearTemporaryGoogleTokens();
  const destination = new URLSearchParams({ saved: "google", imported: String(result.imported) });
  if (result.syncError) destination.set("sync_error", result.syncError);

  redirect(`/integrations?${destination.toString()}`);
}

export default async function SelectGoogleLocationPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const merchant = await getMerchant();
  const temporaryTokens = await getTemporaryGoogleTokens();
  const googleConnection = merchant ? await getGoogleConnection(merchant) : null;
  const accessToken = temporaryTokens.accessToken ?? googleConnection?.access_token_encrypted;

  if (!merchant || !accessToken) {
    redirect("/integrations?error=Connexion%20Google%20expir%C3%A9e");
  }

  let locations = [] as Awaited<ReturnType<typeof getGoogleBusinessLocations>>;
  let errorMessage: string | null = null;

  try {
    locations = await getGoogleBusinessLocations(accessToken);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Impossible de récupérer vos fiches Google Business pour le moment.";
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[#E9D5FF] bg-white p-6 shadow-[0_14px_44px_rgba(76,29,149,0.08)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Google Business</p>
        <h1 className="text-3xl font-black tracking-[-0.05em] text-[#211432]">Choisissez votre fiche Google</h1>
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-[#F5C2C7] bg-[#FFF5F5] p-4">
            <p className="text-sm font-semibold text-[#B42318]">Connexion Google incomplète</p>
            <p className="mt-1 text-sm leading-6 text-[#7A271A]">{errorMessage}</p>
            <p className="mt-2 text-sm leading-6 text-[#7A271A]">
              Votre compte Google est déjà autorisé. Cette étape sert seulement à récupérer la liste des fiches ; inutile de refaire toute la connexion OAuth si Google limite temporairement les requêtes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="/settings/google-business/select-location"
                className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]"
              >
                Réessayer de récupérer les fiches
              </a>
              <a
                href="/integrations"
                className="inline-flex items-center justify-center rounded-lg border border-[#E9D5FF] bg-white px-4 py-2.5 text-sm font-semibold text-[#4C1D95] transition hover:bg-[#FBFAFF]"
              >
                Retour aux intégrations
              </a>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-[#6B617F]">
              AtriumOne a trouvé {locations.length} fiche{locations.length > 1 ? "s" : ""}. Sélectionnez celle à connecter pour importer les avis.
            </p>
            {locations.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-[#E9D5FF] bg-[#FBFAFF] p-5">
                <p className="text-sm font-semibold text-[#211432]">Aucune fiche trouvée</p>
                <p className="mt-1 text-sm leading-6 text-[#6B617F]">
                  Le compte Google connecté ne semble pas avoir accès à une fiche Google Business Profile.
                </p>
              </div>
            ) : null}
            <div className="mt-6 space-y-3">
              {locations.map((location) => (
                <form key={location.locationId} action={selectGoogleLocation} className="rounded-2xl border border-[#E9D5FF] bg-[#FBFAFF] p-4">
                  <input type="hidden" name="location_id" value={location.locationId} />
                  <input type="hidden" name="location_name" value={location.locationName} />
                  <input type="hidden" name="granted_scopes" value="openid,email,https://www.googleapis.com/auth/business.manage" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-bold text-[#211432]">{location.locationName}</div>
                      <div className="mt-1 text-xs leading-5 text-[#8B7AA8]">{location.address ?? "Adresse indisponible"}</div>
                    </div>
                    <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
                      Connecter cette fiche
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
