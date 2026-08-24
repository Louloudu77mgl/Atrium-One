"use client";

export function AutomationToolbar({
  title,
  status,
  zoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoom,
  onAutoLayout,
  onValidate,
  onTest,
  onRun,
  onHistory,
  onBack,
  onActivate,
  onRecenter,
  autosaveLabel,
  feedback
}: {
  title: string;
  status: string;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (delta: number) => void;
  onAutoLayout: () => void;
  onValidate: () => void;
  onTest: () => void;
  onRun: () => void;
  onHistory: () => void;
  onBack: () => void;
  onActivate: () => void;
  onRecenter: () => void;
  autosaveLabel: string;
  feedback?: string | null;
}) {
  const saved = autosaveLabel.startsWith("Sauvegardé") || autosaveLabel.includes("active côté serveur");
  const active = status === "Active";

  return (
    <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-4 border-b border-[#E7E2DB] bg-white px-5 py-3 shadow-[0_6px_24px_rgba(23,19,31,0.05)]">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quitter le workflow"
          title="Quitter le workflow"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E3DED7] bg-[#F8F6F2] text-[#17131F] transition hover:border-[#CFC7BC] hover:bg-[#EFEAE3]"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="truncate text-[18px] font-extrabold text-[#17131F]">{title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? "bg-[#EAF7EE] text-[#237A44]" : "bg-[#F1ECFB] text-[#5B2A9E]"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#35A764]" : "bg-[#7C4DCB]"}`} />
              {status}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${saved ? "border-[#BFE4CA] bg-[#F0FAF3] text-[#237A44]" : "border-[#DCCEF2] bg-[#F8F5FF] text-[#5B2A9E]"}`}>
              {saved ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              ) : (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7C4DCB]" />
              )}
              {autosaveLabel}
            </span>
            {feedback ? <span className="inline-flex rounded-full bg-[#2B1A4A] px-2.5 py-1 text-[11px] font-bold text-white">{feedback}</span> : null}
            <span className="text-[11px] font-medium text-[#8A8491]">Échap pour quitter</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onUndo} disabled={!canUndo} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F] disabled:opacity-40">Annuler</button>
        <button type="button" onClick={onRedo} disabled={!canRedo} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F] disabled:opacity-40">Rétablir</button>
        <button type="button" onClick={() => onZoom(-0.1)} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">−</button>
        <div className="rounded-[10px] bg-[#F6F3EF] px-3 py-2 text-sm font-semibold text-[#17131F]">{Math.round(zoom * 100)} %</div>
        <button type="button" onClick={() => onZoom(0.1)} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">+</button>
        <button type="button" onClick={onRecenter} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Recentrer</button>
        <button type="button" onClick={onAutoLayout} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Réorganiser</button>
        <button type="button" onClick={onValidate} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Vérifier</button>
        <button type="button" onClick={onRun} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Simuler</button>
        <button type="button" onClick={onHistory} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Historique</button>
        <button type="button" onClick={onTest} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Mode test</button>
        <button type="button" onClick={onActivate} className="rounded-[10px] bg-[#2B1A4A] px-4 py-2.5 text-sm font-semibold text-white">Publier</button>
      </div>
    </div>
  );
}
