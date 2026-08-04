"use client";

import type { ExecutionRecord } from "./types";

export function AutomationHistory({
  history,
  selectedRunId,
  onSelect
}: {
  history: ExecutionRecord[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-[#EBE6DF] bg-white p-5 shadow-[0_8px_24px_rgba(23,19,31,0.05)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Historique d’exécution</div>
      <h3 className="mt-2 text-[18px] font-extrabold text-[#17131F]">Derniers passages dans le flow</h3>
      <div className="mt-4 space-y-3">
        {history.length ? history.map((run) => (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelect(run.id)}
            className={`w-full rounded-[18px] border p-4 text-left ${selectedRunId === run.id ? "border-[#6E4DE0] bg-[#FBF8FF]" : "border-[#EBE6DF] bg-[#F9F7F4]"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px] font-bold text-[#17131F]">{run.customerName}</div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6E6A76]">{statusLabel(run.status)}</span>
            </div>
            <div className="mt-2 text-[12.5px] leading-5 text-[#6E6A76]">
              {run.triggerLabel} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.createdAt))}<br />
              Durée : {run.durationLabel} · {run.steps.length} bloc(s) exécuté(s)
            </div>
          </button>
        )) : <div className="rounded-[18px] border border-dashed border-[#EBE6DF] bg-[#F9F7F4] p-4 text-[13px] text-[#6E6A76]">Aucune exécution pour le moment.</div>}
      </div>
    </section>
  );
}

function statusLabel(status: ExecutionRecord["status"]) {
  switch (status) {
    case "success":
      return "Réussi";
    case "pending":
      return "En attente";
    case "failed":
      return "Échec";
    case "cancelled":
      return "Annulé";
    case "validation_required":
      return "Validation requise";
  }
}

