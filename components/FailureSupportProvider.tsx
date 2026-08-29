"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ImportantFailure = {
  type: string;
  feature: string;
  action: string;
  executionId?: string | null;
};

type FailureSupportContextValue = {
  reportImportantFailure: (failure: ImportantFailure) => void;
};

const FailureSupportContext = createContext<FailureSupportContextValue | null>(null);
const DEDUPLICATION_DELAY_MS = 5 * 60 * 1000;

export function FailureSupportProvider({ children }: { children: React.ReactNode }) {
  const [failure, setFailure] = useState<ImportantFailure | null>(null);
  const displayedFailures = useRef(new Map<string, number>());
  const bookingUrl = process.env.NEXT_PUBLIC_CSM_BOOKING_URL?.trim() || null;

  const reportImportantFailure = useCallback((nextFailure: ImportantFailure) => {
    const key = [nextFailure.type, nextFailure.feature, nextFailure.action, nextFailure.executionId ?? ""].join(":");
    const lastDisplayedAt = displayedFailures.current.get(key) ?? 0;
    let sessionDisplayedAt = 0;
    try {
      sessionDisplayedAt = Number(window.sessionStorage.getItem(`atriumone:failure:${key}`) ?? 0);
    } catch {}
    if (Date.now() - Math.max(lastDisplayedAt, sessionDisplayedAt) < DEDUPLICATION_DELAY_MS) return;
    displayedFailures.current.set(key, Date.now());
    try {
      window.sessionStorage.setItem(`atriumone:failure:${key}`, String(Date.now()));
    } catch {}
    setFailure(nextFailure);
  }, []);

  const value = useMemo(() => ({ reportImportantFailure }), [reportImportantFailure]);

  return (
    <FailureSupportContext.Provider value={value}>
      {children}
      {failure ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1E1530]/45 p-4" role="presentation" onMouseDown={() => setFailure(null)}>
          <section className="w-full max-w-[500px] rounded-[24px] border border-[#E8E1F0] bg-white p-6 shadow-[0_24px_70px_rgba(30,21,48,0.24)]" role="dialog" aria-modal="true" aria-labelledby="failure-support-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4ECFF] text-2xl text-[#5B2A9E]">!</div>
            <h2 id="failure-support-title" className="text-[24px] font-extrabold tracking-[-0.02em] text-[#1E1B2E]">Un problème est survenu</h2>
            <p className="mt-3 text-[14px] leading-6 text-[#6E6B80]">
              AtriumOne n&apos;a pas pu terminer cette action. Vous pouvez réessayer ou prendre rendez-vous avec votre CSM pour être accompagné.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                disabled={!bookingUrl}
                title={bookingUrl ? undefined : "Ajoutez NEXT_PUBLIC_CSM_BOOKING_URL pour activer la prise de rendez-vous."}
                onClick={() => {
                  if (!bookingUrl) return;
                  window.open(bookingUrl, "_blank", "noopener,noreferrer");
                  setFailure(null);
                }}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[#5B2A9E] px-5 py-3 text-[13.5px] font-semibold text-white transition hover:bg-[#4B237F] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Prendre RDV avec son CSM
              </button>
              <button type="button" onClick={() => setFailure(null)} className="inline-flex flex-1 items-center justify-center rounded-full border border-[#E3DAF1] bg-white px-5 py-3 text-[13.5px] font-semibold text-[#4B2E83] transition hover:border-[#7C4DCB]">
                Non merci
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </FailureSupportContext.Provider>
  );
}

export function useFailureSupport() {
  const context = useContext(FailureSupportContext);
  if (!context) throw new Error("useFailureSupport doit être utilisé dans FailureSupportProvider.");
  return context;
}
