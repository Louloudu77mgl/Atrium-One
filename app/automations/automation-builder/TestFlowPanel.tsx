"use client";

import type { ExecutionRecord, TestScenario } from "./types";

const inputClass = "w-full rounded-[12px] border border-[#EBE6DF] bg-white px-3 py-2.5 text-sm text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0]";

export function TestFlowPanel({
  open,
  scenario,
  result,
  onScenarioChange,
  onRun,
  onClose
}: {
  open: boolean;
  scenario: TestScenario;
  result: ExecutionRecord | null;
  onScenarioChange: (next: TestScenario) => void;
  onRun: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17131F]/40 p-4">
      <div className="grid max-h-[85vh] w-full max-w-5xl gap-4 overflow-hidden rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_24px_80px_rgba(33,20,50,0.28)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3 overflow-y-auto pr-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Mode test</div>
              <h3 className="mt-2 text-[20px] font-extrabold text-[#17131F]">Simuler une exécution sans rien envoyer</h3>
            </div>
            <button type="button" onClick={onClose} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Fermer</button>
          </div>

          <label className="block">
            <span className="mb-1 block text-[12px] font-bold text-[#6E6A76]">Client test</span>
            <input className={inputClass} value={scenario.customerName} onChange={(event) => onScenarioChange({ ...scenario, customerName: event.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-bold text-[#6E6A76]">Nombre de visites</span>
            <input className={inputClass} type="number" value={scenario.visits} onChange={(event) => onScenarioChange({ ...scenario, visits: Number(event.target.value) })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-bold text-[#6E6A76]">Récompenses gagnées</span>
            <input className={inputClass} type="number" value={scenario.rewards} onChange={(event) => onScenarioChange({ ...scenario, rewards: Number(event.target.value) })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-bold text-[#6E6A76]">Note d’avis</span>
            <input className={inputClass} type="number" min={1} max={5} value={scenario.reviewRating} onChange={(event) => onScenarioChange({ ...scenario, reviewRating: Number(event.target.value) })} />
          </label>
          <label className="flex items-center gap-3 rounded-[16px] bg-[#F6F3EF] px-4 py-3 text-sm font-medium text-[#17131F]">
            <input type="checkbox" checked={scenario.marketingConsent} onChange={(event) => onScenarioChange({ ...scenario, marketingConsent: event.target.checked })} />
            Le client a accepté les e-mails marketing
          </label>
          <label className="flex items-center gap-3 rounded-[16px] bg-[#F6F3EF] px-4 py-3 text-sm font-medium text-[#17131F]">
            <input type="checkbox" checked={scenario.returnedAfterDelay} onChange={(event) => onScenarioChange({ ...scenario, returnedAfterDelay: event.target.checked })} />
            Le client est revenu après le délai
          </label>
          <button type="button" onClick={onRun} className="inline-flex rounded-[10px] bg-[#2B1A4A] px-4 py-2.5 text-sm font-semibold text-white">Tester le flow</button>
        </div>

        <div className="overflow-y-auto rounded-[22px] bg-[#F9F7F4] p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Résultat</div>
          {result ? (
            <>
              <div className="mt-2 text-[15px] font-extrabold text-[#17131F]">{result.customerName}</div>
              <div className="mt-1 text-[13px] text-[#6E6A76]">
                Déclencheur : {result.triggerLabel} · Statut : {result.status === "validation_required" ? "Validation requise" : "Réussi"}
              </div>
              <div className="mt-4 space-y-3">
                {result.steps.map((step, index) => (
                  <div key={step.id} className="rounded-[18px] border border-[#EBE6DF] bg-white p-4">
                    <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Étape {index + 1}</div>
                    <div className="mt-1 text-[14px] font-bold text-[#17131F]">{step.title}</div>
                    <div className="mt-1 text-[13px] text-[#6E6A76]">{step.result}</div>
                    {step.branch ? <div className="mt-2 inline-flex rounded-full bg-[#F1ECFB] px-2.5 py-1 text-[11px] font-semibold text-[#6E4DE0]">Branche choisie : {step.branch === "yes" ? "Oui" : "Non"}</div> : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-3 text-[13px] leading-6 text-[#6E6A76]">Lancez un test pour voir bloc par bloc ce qui se passe, sans envoyer d’e-mail ni publier de contenu.</div>
          )}
        </div>
      </div>
    </div>
  );
}

