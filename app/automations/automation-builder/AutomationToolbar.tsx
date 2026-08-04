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
  autosaveLabel
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
}) {
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
          <div className="text-[12px] font-medium text-[#6E6A76]">{status} · {autosaveLabel} · Échap pour quitter</div>
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
        <button type="button" onClick={onValidate} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Tester</button>
        <button type="button" onClick={onRun} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Exécuter</button>
        <button type="button" onClick={onHistory} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Historique</button>
        <button type="button" onClick={onTest} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Mode test</button>
        <button type="button" onClick={onActivate} className="rounded-[10px] bg-[#2B1A4A] px-4 py-2.5 text-sm font-semibold text-white">Publier</button>
      </div>
    </div>
  );
}
