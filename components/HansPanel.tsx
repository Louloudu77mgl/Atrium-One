"use client";

import { useEffect, useState } from "react";
import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";
import type { Review } from "@/lib/mock-data";
import { isUrgentReview } from "@/lib/review-status";
import { sanitizeHansHtml } from "@/lib/sanitize-hans-html";

export function HansPanel({
  selectedReview,
  reply,
  isGenerating,
  error,
  onRegenerate,
  onPublish,
  isPublishing,
  onSaveEdit,
  isSavingEdit,
  isEdited,
  replyStatus,
  embedded,
  onGenerate
}: {
  selectedReview?: Review;
  reply?: string | null;
  isGenerating?: boolean;
  error?: string | null;
  onRegenerate?: () => void;
  onPublish?: () => Promise<void>;
  isPublishing?: boolean;
  onSaveEdit?: (replyText: string) => Promise<void>;
  isSavingEdit?: boolean;
  isEdited?: boolean;
  replyStatus?: string | null;
  embedded?: boolean;
  onGenerate?: () => void;
}) {
  const [validated, setValidated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftReply, setDraftReply] = useState("");
  const sanitizedReply = reply ? sanitizeHansHtml(reply) : null;
  const statusLabel =
    replyStatus === "approved" || replyStatus === "selected" ? "Prêt à publier" :
    replyStatus === "generated" ? "Générée" :
    replyStatus === "published" ? "Répondu" :
    replyStatus === "superseded" ? "Remplacée" :
    replyStatus;

  useEffect(() => {
    setValidated(false);
    setIsEditing(false);
    setDraftReply(reply ?? "");
  }, [selectedReview, reply]);

  async function publishReply() {
    if (!onPublish) {
      return;
    }

    await onPublish();
    setValidated(true);
  }

  async function saveEdit() {
    if (!onSaveEdit) {
      return;
    }

    await onSaveEdit(draftReply);
    setIsEditing(false);
  }

  return (
    <aside className={embedded ? "min-w-0 bg-white" : "min-w-0 overflow-hidden rounded-[16px] border border-[#E9D5FF] bg-white shadow-[0_10px_30px_rgba(76,29,149,0.08)] xl:sticky xl:top-[84px]"}>
      {!embedded ? <div className="flex items-center gap-2.5 bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] px-[18px] py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white shadow-sm">
          <HansAvatar size={34} />
        </div>
        <div>
          <div className="text-sm font-bold text-white">Réponse générée par Hans</div>
          <div className="mt-0.5 text-[11px] text-white/50">Personnalisée pour votre boutique</div>
        </div>
      </div> : null}

      <div className="p-[18px]">
        <div className="mb-3.5 rounded-lg bg-[#F5F0FF] px-3 py-2.5 text-xs text-[#6B617F]">
          <strong className="mb-0.5 block text-[13px] text-[#211432]">
            {selectedReview ? `${selectedReview.author} — ${selectedReview.rating} étoiles` : "—"}
          </strong>
          {selectedReview ? `${isUrgentReview(selectedReview) ? "Avis urgent" : "Avis à traiter"} · ${selectedReview.sentiment} · ${selectedReview.date}` : "Sélectionnez un avis pour générer une réponse"}
        </div>

        <div className={`mb-3.5 min-h-[150px] rounded-lg border p-3.5 text-[13px] leading-6 ${reply ? "border-[#DDD6FE] bg-[#FBFAFF] text-[#211432]" : error ? "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]" : "border-[#E9D5FF] bg-[#F5F0FF] text-[#6B617F]"}`}>
          {reply ? (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-[#6B617F]">
                {isEdited ? "Réponse modifiée" : "Réponse Hans"}
              </span>
              {statusLabel ? (
                <span className="rounded-full bg-[#F3F0FF] px-2.5 py-1 text-[10px] font-semibold text-[#4C1D95]">
                  {statusLabel}
                </span>
              ) : null}
              {isEdited ? (
                <span className="rounded-full bg-[#F3E8FF] px-2.5 py-1 text-[10px] font-semibold text-[#7C3AED]">
                  Modifiée manuellement
                </span>
              ) : null}
            </div>
          ) : null}
          {!selectedReview ? <span>Sélectionnez un avis pour que Hans prépare une réponse.</span> : null}
          {isGenerating ? (
            <div className="flex items-center gap-2 text-[#6B617F]">
              <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#DDD6FE] border-t-[#7C3AED] [animation:spin-once_0.8s_linear_infinite]" />
              <div>
                <strong className="block text-[#4C1D95]">Hans rédige votre réponse...</strong>
                <span className="text-xs">Génération et sauvegarde Supabase en cours.</span>
              </div>
            </div>
          ) : null}
          {error && !isGenerating ? <span>{error}</span> : null}
          {isEditing ? (
            <textarea
              value={draftReply}
              onChange={(event) => setDraftReply(event.target.value)}
              className="min-h-[180px] w-full resize-y rounded-lg border border-[#E9D5FF] bg-white px-3 py-2.5 text-[13px] leading-6 text-[#211432] outline-none transition focus:border-[#4C1D95]"
            />
          ) : null}
          {sanitizedReply && !isEditing ? <div className="[&_p:not(:last-child)]:mb-3" dangerouslySetInnerHTML={{ __html: sanitizedReply }} /> : null}
          {validated || replyStatus === "approved" || replyStatus === "selected" ? <span className="mt-3 block font-semibold text-[#7C3AED]">Cette réponse a été validée par le commerçant.</span> : null}
        </div>

        {selectedReview && !reply && !isGenerating && !error && onGenerate ? (
          <div className="mb-3.5">
            <button type="button" onClick={onGenerate} className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#6D28D9]">
              Générer une réponse
            </button>
          </div>
        ) : null}

        {reply ? (
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button type="button" onClick={() => setIsEditing(false)} className="inline-flex items-center justify-center rounded-lg border border-[#E9D5FF] px-3 py-1.5 text-xs font-semibold text-[#6B617F] transition hover:border-[#4C1D95] hover:bg-[#F3F0FF] hover:text-[#4C1D95]">
                  Annuler
                </button>
                <button type="button" onClick={saveEdit} disabled={isSavingEdit} className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSavingEdit ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </>
            ) : (
              <>
                {replyStatus !== "approved" && replyStatus !== "selected" && !validated ? (
                  <button type="button" onClick={publishReply} disabled={isPublishing} className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60">
                    {isPublishing ? "Validation..." : "Valider la réponse"}
                  </button>
                ) : null}
                <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center justify-center rounded-lg border border-[#E9D5FF] px-3 py-1.5 text-xs font-semibold text-[#6B617F] transition hover:border-[#4C1D95] hover:bg-[#F3F0FF] hover:text-[#4C1D95]">
                  Modifier la réponse
                </button>
                <button type="button" onClick={onRegenerate} className="inline-flex items-center justify-center rounded-lg border border-[#E9D5FF] px-3 py-1.5 text-xs font-semibold text-[#6B617F] transition hover:border-[#4C1D95] hover:bg-[#F3F0FF] hover:text-[#4C1D95]">
                  Régénérer
                </button>
                <button type="button" className="inline-flex items-center justify-center rounded-lg bg-[#F3F4F6] px-3 py-1.5 text-xs font-semibold text-[#211432] transition hover:bg-[#E9D5FF]">
                  Copier
                </button>
              </>
            )}
          </div>
        ) : null}

        <div className="mt-3.5 border-t border-[#E9D5FF] pt-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[#6B617F]"><Icon name="check" className="h-3.5 w-3.5" /> Qualité de la réponse</div>
          <div className="flex flex-wrap gap-1.5">
            {["Ton professionnel", "Empathique", "SEO-friendly"].map((label) => (
              <span key={label} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${reply ? "bg-[#F3E8FF] text-[#7C3AED]" : "bg-[#F3F4F6] text-[#6B617F]"}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
