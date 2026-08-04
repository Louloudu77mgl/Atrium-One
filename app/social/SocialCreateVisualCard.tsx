"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HansGeneratingModal } from "@/components/HansGeneratingModal";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import type { MerchantMediaAssetRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";

export function SocialCreateVisualCard({ galleryAssets }: { galleryAssets: MerchantMediaAssetRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<"ai" | "gallery">("ai");
  const [selectedAssetId, setSelectedAssetId] = useState(galleryAssets[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (window.location.hash === "#create-with-hans") {
      setOpen(true);
      document.getElementById("create-with-hans")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, []);

  async function submitTopic() {
    const normalizedTopic = topic.trim();

    if (!normalizedTopic || submitting) {
      return;
    }

    setSubmitting(true);
    const selectedAsset = galleryAssets.find((asset) => asset.id === selectedAssetId);
    const payload: Record<string, string> = {
      platform: "instagram",
      title: normalizedTopic,
      angle: `Créer une publication claire, utile et engageante sur : ${normalizedTopic}`,
      source: `Sujet demandé par le commerce : ${normalizedTopic}`
    };
    if (mode === "gallery" && selectedAsset) {
      payload.assetUrl = selectedAsset.url;
      if (selectedAsset.alt_text) payload.assetAltText = selectedAsset.alt_text;
      if (selectedAsset.category) payload.category = selectedAsset.category;
    }

    try {
      const response = await fetch("/api/social/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { post?: { id: string }; error?: string };

      if (!response.ok || !data.post) {
        throw new Error(data.error ?? "Création du brouillon impossible.");
      }

      router.push(`/social/editor/${data.post.id}`);
    } catch (error) {
      setSubmitting(false);
      showToast(getUserErrorMessage(error, "Création du brouillon impossible."), "error");
    }
  }

  return (
    <>
      <div id="create-with-hans" className="rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-[#211432]">Prompt Hans pour créer un post</h3>
            <p className="mt-1 text-sm text-[#6B617F]">Décrivez le sujet à Hans, choisissez une image IA ou votre galerie, puis laissez-le préparer le post.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex w-fit rounded-xl bg-[#4C1D95] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#6D28D9]"
          >
            Ouvrir Hans
          </button>
        </div>

        {open ? (
          <div className="mt-4 rounded-2xl bg-[#FBFAFF] p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode("ai")} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${mode === "ai" ? "bg-[#4C1D95] text-white" : "bg-white text-[#4C1D95] ring-1 ring-[#E9D5FF]"}`}>
                Générer une image IA
              </button>
              <button type="button" onClick={() => setMode("gallery")} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${mode === "gallery" ? "bg-[#4C1D95] text-white" : "bg-white text-[#4C1D95] ring-1 ring-[#E9D5FF]"}`}>
                Utiliser ma galerie
              </button>
            </div>
            <label className="block text-sm font-bold text-[#211432]">
              De quel sujet voulez-vous que la publi traite ?
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Ex : nos bouquets de mariage, la rentrée, un nouveau menu..."
                className="mt-2 w-full rounded-xl border border-[#E9D5FF] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#7C3AED]"
              />
            </label>
            {mode === "gallery" ? (
              galleryAssets.length > 0 ? (
                <label className="mt-3 block text-sm font-bold text-[#211432]">
                  Choisissez une image
                  <select value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} className="mt-2 w-full rounded-xl border border-[#E9D5FF] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#7C3AED]">
                    {galleryAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.category ?? "Galerie"} · {asset.alt_text ?? "Image du commerce"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-[#D8B4FE] bg-white p-3 text-sm text-[#6B617F]">
                  Ajoutez d’abord une image dans votre galerie pour utiliser cette option.
                </div>
              )
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void submitTopic()}
                disabled={submitting || !topic.trim() || (mode === "gallery" && galleryAssets.length === 0)}
                className="rounded-xl bg-[#4C1D95] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                {submitting ? "Hans prépare le post..." : "Lancer Hans"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTopic("");
                }}
                className="rounded-xl bg-[#F3E8FF] px-4 py-2.5 text-sm font-bold text-[#4C1D95] transition hover:-translate-y-0.5"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <HansGeneratingModal
        open={submitting}
        title="Hans crée votre visuel"
        description="Hans récupère votre sujet, rédige la publication et prépare un visuel cohérent avec votre charte sociale."
      />
      <Toast toast={toast} />
    </>
  );
}
