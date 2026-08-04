"use client";

import { HansPanel } from "@/components/HansPanel";
import { HansAvatar } from "@/components/hans-avatar";
import type { Review } from "@/lib/mock-data";

export function HansFloatingChat({
  open,
  onOpenChange,
  selectedReview,
  reply,
  isGenerating,
  error,
  onGenerate,
  onRegenerate,
  onPublish,
  isPublishing,
  onSaveEdit,
  isSavingEdit,
  isEdited,
  replyStatus
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedReview?: Review;
  reply?: string | null;
  isGenerating?: boolean;
  error?: string | null;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onPublish?: () => Promise<void>;
  isPublishing?: boolean;
  onSaveEdit?: (replyText: string) => Promise<void>;
  isSavingEdit?: boolean;
  isEdited?: boolean;
  replyStatus?: string | null;
}) {
  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-[430px] overflow-hidden rounded-[22px] border border-[#E9D5FF] bg-white shadow-[0_24px_70px_rgba(76,29,149,0.26)] md:bottom-24 md:right-6">
          <div className="flex items-center justify-between bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white shadow-sm">
                <HansAvatar size={34} />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#C084FC] ring-2 ring-[#5B21B6]" />
              </div>
              <div>
                <div className="text-sm font-black">Hans</div>
                <div className="text-[11px] text-white/65">Agent IA AtriumOne</div>
              </div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg p-2 text-white/75 transition hover:bg-white/10 hover:text-white" aria-label="Fermer Hans">
              ×
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <HansPanel
              selectedReview={selectedReview}
              reply={reply}
              isGenerating={isGenerating}
              error={error}
              onGenerate={onGenerate}
              onRegenerate={onRegenerate}
              onPublish={onPublish}
              isPublishing={isPublishing}
              onSaveEdit={onSaveEdit}
              isSavingEdit={isSavingEdit}
              isEdited={isEdited}
              replyStatus={replyStatus}
              embedded
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="fixed bottom-5 right-4 z-50 flex items-center gap-2 rounded-full border border-[#E9D5FF] bg-white px-3.5 py-2.5 text-sm font-bold text-[#4C1D95] shadow-[0_14px_35px_rgba(76,29,149,0.20)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(76,29,149,0.26)] md:bottom-6 md:right-6"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white">
          <HansAvatar size={34} />
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#22C55E] ring-2 ring-white" />
        </span>
        Hans
      </button>
    </>
  );
}
