"use client";

import { useState } from "react";
import { HansGeneratingModal } from "@/components/HansGeneratingModal";
import { Icon } from "@/components/icons";
import type { Review } from "@/lib/mock-data";

type AdminReviewFormProps = {
  demo?: boolean;
  onCreated: (review: Review) => void;
  onToast: (message: string, tone: "success" | "error" | "saving") => void;
};

export function AdminReviewForm({ demo = false, onCreated, onToast }: AdminReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function createReview(formData: FormData) {
    if (saving) {
      return;
    }

    setSaving(true);
    onToast(demo ? "Ajout de l’avis de démo..." : "Création de l'avis test...", "saving");

    try {
      const response = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          author_name: String(formData.get("author_name") ?? ""),
          rating: Number(formData.get("rating") ?? 5),
          review_text: String(formData.get("review_text") ?? "")
        })
      });

      const data = (await response.json()) as { review?: Review; error?: string };

      if (!response.ok || !data.review) {
        throw new Error(data.error ?? "Impossible de créer l'avis.");
      }

      onCreated(data.review);
      onToast(demo ? "Avis de démo ajouté" : "Avis test créé", "success");
      setOpen(false);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Erreur inattendue.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="mb-5 rounded-[14px] border border-[#DDD6FE] bg-[#F5F0FF] p-4">
        <button type="button" aria-expanded={open} disabled={saving} onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left disabled:opacity-60">
          <span>
            <span className="mb-1 flex items-center gap-2 text-sm font-bold text-[#4C1D95]">
              <Icon name="sparkle" className="h-4 w-4" /> {demo ? "Compte de démo · Boulangerie Oulah" : "Admin test · Créer un avis"}
            </span>
            <span className="text-sm text-[#6B617F]">{demo ? "Ajoutez ou supprimez des avis pour préparer votre démonstration. Ces changements restent dans AtriumOne." : "Ajoutez un avis test pour essayer Hans et le rapport."}</span>
          </span>
          <span className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-[#4C1D95]">{open ? "Fermer" : "Ajouter un avis"}</span>
        </button>

        {open ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (saving) {
                return;
              }

              const formData = new FormData(event.currentTarget);
              void createReview(formData);
            }}
            className="mt-4 grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-2"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Nom client</span>
              <input name="author_name" required maxLength={120} disabled={saving} defaultValue={demo ? "" : "Client test"} placeholder="Nom du client" className="w-full rounded-lg border border-[#E9D5FF] px-3 py-2 text-sm outline-none focus:border-[#4C1D95]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Note</span>
              <select name="rating" defaultValue="5" disabled={saving} className="w-full rounded-lg border border-[#E9D5FF] px-3 py-2 text-sm outline-none focus:border-[#4C1D95]">
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}
              </select>
            </label>
            <div className="rounded-lg border border-[#E9D5FF] bg-[#FBFAFF] px-3 py-2 text-xs leading-5 text-[#6B617F] sm:col-span-2">
              Hans analyse automatiquement le sentiment et l'urgence selon la note et le contenu de l'avis.
            </div>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Contenu de l'avis</span>
              <textarea name="review_text" required maxLength={5000} disabled={saving} rows={3} defaultValue={demo ? "" : "Très bonne expérience, équipe agréable et service rapide."} placeholder="Écrivez l’avis à utiliser pendant la démo…" className="w-full resize-y rounded-lg border border-[#E9D5FF] px-3 py-2 text-sm outline-none focus:border-[#4C1D95]" />
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={saving} className="rounded-lg bg-[#4C1D95] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Ajout..." : demo ? "Ajouter l’avis" : "Créer l'avis test"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
      <HansGeneratingModal
        open={saving}
        title="Hans enregistre l’avis"
        description="Hans ajoute l’avis et analyse son sentiment pour actualiser votre tableau de bord."
      />
    </>
  );
}
