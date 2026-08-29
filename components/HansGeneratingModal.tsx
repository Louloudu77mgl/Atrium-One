"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HansAvatar } from "@/components/hans-avatar";

export function HansGeneratingModal({
  open,
  title = "Hans prépare votre contenu",
  description = "Hans analyse le contexte, rédige le post et prépare un visuel cohérent avec votre identité.",
  steps,
  statusText = "Hans prépare cela pour vous.",
  progressDurationMs
}: {
  open: boolean;
  title?: string;
  description?: string;
  steps?: [string, string, string, string];
  statusText?: string;
  progressDurationMs?: number;
}) {
  const [progress, setProgress] = useState(8);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setProgress(8);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const target = progressDurationMs
        ? Math.min(94, 8 + (elapsed / progressDurationMs) * 86)
        : elapsed < 4_000
          ? 8 + (elapsed / 4_000) * 20
          : elapsed < 12_000
            ? 28 + ((elapsed - 4_000) / 8_000) * 30
            : elapsed < 30_000
              ? 58 + ((elapsed - 12_000) / 18_000) * 26
              : Math.min(94, 84 + ((elapsed - 30_000) / 30_000) * 10);
      setProgress((current) => Math.max(current, Math.round(target)));
    }, 500);

    return () => window.clearInterval(timer);
  }, [open, progressDurationMs]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousCursor = document.body.style.cursor;
    const previousPosition = document.body.style.position;
    const previousInset = document.body.style.inset;
    const previousWidth = document.body.style.width;
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "progress";
    document.body.style.position = "fixed";
    document.body.style.inset = "0";
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.cursor = previousCursor;
      document.body.style.position = previousPosition;
      document.body.style.inset = previousInset;
      document.body.style.width = previousWidth;
    };
  }, [open]);

  if (!open || !mounted) {
    return null;
  }

  const progressSteps = steps ?? ["Analyse de votre demande", "Préparation du contenu", "Direction artistique et mise en page", "Vérifications finales"];
  const progressLabel = progress < 28
    ? progressSteps[0]
    : progress < 58
      ? progressSteps[1]
      : progress < 84
        ? progressSteps[2]
        : progressSteps[3];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-[#F4EEFF] px-4"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#E9D5FF_0%,#F4EEFF_36%,#F4EEFF_100%)]" />
      <div className="relative w-full max-w-[676px] rounded-[34px] border border-white/90 bg-white px-10 py-9 shadow-[0_30px_120px_rgba(44,17,87,0.18)] [animation:modal-in_0.2s_ease]">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#E9D5FF] bg-[#FCFAFF] shadow-[0_8px_24px_rgba(124,58,237,0.10)]">
            <HansAvatar size={46} />
          </div>
          <div className="max-w-[500px]">
            <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#211432] sm:text-[20px]">{title}</h2>
            <p className="mt-2 text-[15px] leading-8 text-[#7B7393]">{description}</p>
          </div>
        </div>

        <div className="mb-2 h-3 overflow-hidden rounded-full bg-[#EFEDF6]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#5B21B6] via-[#7C3AED] to-[#C084FC] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mb-6 flex items-center justify-between text-[13px] text-[#7B7393]">
          <span>{progressLabel}</span>
          <span>{progress}%</span>
        </div>

        <div className="rounded-[24px] bg-[#FAF7FF] px-5 py-4 text-[13px] leading-6 text-[#6B617F]">
          <div className="flex items-center gap-3 text-[#6D28D9]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#E9D5FF] bg-white shadow-sm">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[#DDD6FE] border-t-[#8B5CF6] [animation:spin-once_0.8s_linear_infinite]" />
            </span>
            {statusText}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
