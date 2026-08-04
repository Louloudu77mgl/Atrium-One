"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export function DevResetReviewsButton({
  onReset,
  onClear
}: {
  onReset?: () => void;
  onClear?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reset() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/dev/reset-test-reviews", { method: "POST" });
      const data = (await response.json()) as { inserted?: number; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Réinitialisation impossible.");
      }

      setMessage(`${data.inserted ?? 0} avis de test insérés. Rechargez la page.`);
      onReset?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  async function clearReviews() {
    setClearing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/dev/reset-test-reviews", { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Suppression impossible.");
      }

      setMessage("Tous les avis de test ont été supprimés. Rechargez la page.");
      onClear?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur inattendue.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="mb-6 rounded-[14px] border border-dashed border-[#C4B5FD] bg-white px-5 py-4 text-sm text-[#6B617F]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-bold text-[#4C1D95]">Mode développement</div>
          <div className="mt-1 text-xs">Réinjecter ou supprimer tous les avis de test du merchant connecté.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reset} disabled={loading || clearing} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4C1D95] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60">
            <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? "[animation:spin-once_0.8s_linear_infinite]" : ""}`} />
            Réinitialiser les avis de test
          </button>
          <button type="button" onClick={clearReviews} disabled={loading || clearing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E9D5FF] px-4 py-2 text-xs font-semibold text-[#6B617F] transition hover:border-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:cursor-not-allowed disabled:opacity-60">
            <Icon name="trash" className={`h-3.5 w-3.5 ${clearing ? "[animation:spin-once_0.8s_linear_infinite]" : ""}`} />
            Supprimer tous les avis tests
          </button>
        </div>
      </div>
      {message ? <div className="mt-3 text-xs font-semibold text-[#7C3AED]">{message}</div> : null}
    </div>
  );
}
