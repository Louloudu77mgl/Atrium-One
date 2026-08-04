"use client";

import { HansAvatar } from "@/components/hans-avatar";

export type BulkReplyProgress = {
  total: number;
  done: number;
  errors: string[];
  running: boolean;
};

export function BulkReplyModal({
  open,
  onClose,
  progress
}: {
  open: boolean;
  onClose: () => void;
  progress: BulkReplyProgress;
}) {
  if (!open) {
    return null;
  }

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const finished = !progress.running && progress.total > 0 && progress.done + progress.errors.length >= progress.total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2E1065]/55 px-4 backdrop-blur">
      <div className="w-full max-w-[520px] rounded-[20px] bg-white p-8 shadow-[0_8px_32px_rgba(76,29,149,0.13)] [animation:modal-in_0.25s_ease]">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E9D5FF] bg-white shadow-sm">
            <HansAvatar size={42} />
          </div>
          <div>
            <h2 className="text-[19px] font-extrabold text-[#211432]">Hans traite les avis</h2>
            <p className="mt-1 text-[13px] text-[#6B617F]">Chaque avis reçoit une réponse, puis passe automatiquement en statut prêt à publier.</p>
          </div>
        </div>

        <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-[#F3F4F6]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#4C1D95] to-[#A855F7] transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="mb-5 flex items-center justify-between text-xs text-[#6B617F]">
          <span>{progress.done} / {progress.total} avis traités</span>
          <span>{percent}%</span>
        </div>

        <div className="min-h-[112px] rounded-lg bg-[#FBFAFF] p-3.5 text-xs leading-6 text-[#6B617F]">
          {progress.running ? (
            <div className="flex items-center gap-2 text-[#4C1D95]">
              <span className="h-4 w-4 rounded-full border-2 border-[#DDD6FE] border-t-[#7C3AED] [animation:spin-once_0.8s_linear_infinite]" />
              Génération en cours...
            </div>
          ) : null}
          {finished ? <div className="font-semibold text-[#7C3AED]">Génération terminée.</div> : null}
          {progress.errors.length > 0 ? (
            <div className="mt-2 space-y-1 text-[#DC2626]">
              {progress.errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} disabled={progress.running} className="rounded-lg border border-[#E9D5FF] px-4 py-2 text-[13px] font-semibold text-[#6B617F] transition hover:border-[#4C1D95] hover:bg-[#F3F0FF] hover:text-[#4C1D95] disabled:cursor-not-allowed disabled:opacity-50">
            {progress.running ? "Traitement..." : "Fermer"}
          </button>
        </div>
      </div>
    </div>
  );
}
