"use client";

import { useMemo, useState } from "react";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { MerchantMediaAssetRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";

export function SocialGalleryManager({
  initialAssets,
  websiteUrl
}: {
  initialAssets: MerchantMediaAssetRow[];
  websiteUrl?: string | null;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [busy, setBusy] = useState<"upload" | "site" | null>(null);
  const { toast, showToast } = useToast(3500);
  const galleryCountLabel = useMemo(() => `${assets.length} image${assets.length > 1 ? "s" : ""}`, [assets.length]);

  async function uploadImage(file: File) {
    if (busy) return;
    const formData = new FormData();
    formData.set("image", file);
    setBusy("upload");

    try {
      const response = await fetchWithTimeout("/api/social/gallery/upload", { method: "POST", body: formData });
      const data = await response.json() as { asset?: MerchantMediaAssetRow; error?: string };

      if (!response.ok || !data.asset) {
        throw new Error(data.error ?? "Upload impossible.");
      }

      setAssets((current) => [data.asset!, ...current]);
      showToast("Image ajoutée à votre galerie", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Upload impossible."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function importWebsiteImages() {
    if (!websiteUrl?.trim()) {
      showToast("Ajoutez d’abord l’URL du site dans Réglages.", "error");
      return;
    }

    setBusy("site");

    try {
      const response = await fetchWithTimeout("/api/social/gallery/import-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await response.json() as { assets?: MerchantMediaAssetRow[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Import impossible.");
      }

      setAssets((current) => [...(data.assets ?? []), ...current].filter((asset, index, array) => array.findIndex((entry) => entry.url === asset.url) === index));
      showToast("Images du site importées", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Import impossible."), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-[#211432]">Galerie du commerce</h3>
            <p className="mt-1 text-sm text-[#6B617F]">Hans peut utiliser vos propres images pour préparer les posts Instagram.</p>
          </div>
          <div className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-black text-[#7C3AED]">{galleryCountLabel}</div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
          <label className="rounded-2xl border border-[#E9D5FF] bg-[#FBFAFF] px-4 py-3 text-sm font-semibold text-[#211432]">
            Ajouter une image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="mt-2 block w-full text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && busy !== "upload") {
                  void uploadImage(file);
                  event.currentTarget.value = "";
                }
              }}
              disabled={busy === "upload"}
            />
          </label>
          <div className="rounded-2xl border border-[#E9D5FF] bg-[#FBFAFF] px-4 py-3 text-sm text-[#211432]">
            <div className="font-semibold">Site utilisé pour Hans</div>
            <div className="mt-2 break-all text-sm text-[#6B617F]">{websiteUrl?.trim() || "Aucun site renseigné pour le moment."}</div>
          </div>
          {websiteUrl?.trim() ? (
            <button
              type="button"
              onClick={() => void importWebsiteImages()}
              disabled={busy === "site"}
              className="inline-flex h-fit items-center justify-center rounded-xl bg-[#4C1D95] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#6D28D9] disabled:opacity-60"
            >
              {busy === "site" ? "Import..." : "Importer les images du site"}
            </button>
          ) : (
            <a href="/settings" className="inline-flex h-fit items-center justify-center rounded-xl bg-[#F3E8FF] px-4 py-3 text-sm font-bold text-[#4C1D95] transition hover:bg-[#E9D5FF]">
              Ajouter mon site dans Réglages
            </a>
          )}
        </div>

        {assets.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#D8B4FE] bg-[#FBFAFF] p-5 text-sm text-[#6B617F]">
            Aucune image disponible pour le moment. Ajoutez vos visuels ou importez ceux de votre site.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {assets.map((asset) => (
              <article key={asset.id} className="overflow-hidden rounded-[20px] border border-[#E9D5FF] bg-[#FBFAFF]">
                <img src={asset.url} alt={asset.alt_text ?? "Image du commerce"} className="aspect-square w-full object-cover" />
                <div className="space-y-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#7C3AED] ring-1 ring-[#E9D5FF]">{asset.source === "website_scrape" ? "Site web" : "Upload"}</span>
                    {asset.category ? <span className="text-[11px] font-semibold text-[#8B7AA8]">{asset.category}</span> : null}
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-[#6B617F]">{asset.alt_text ?? "Image prête à être utilisée par Hans."}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <Toast toast={toast} />
    </>
  );
}
