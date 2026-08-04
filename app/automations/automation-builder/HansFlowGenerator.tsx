"use client";

export function HansFlowGenerator({
  prompt,
  summary,
  onPromptChange,
  onGenerate,
  onActivate,
  onRegenerate,
  onCancel
}: {
  prompt: string;
  summary: string | null;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onActivate: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-[#EBE6DF] bg-white p-5 shadow-[0_8px_24px_rgba(23,19,31,0.05)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Créer avec Hans</div>
      <h3 className="mt-2 text-[18px] font-extrabold text-[#17131F]">Décrivez votre automatisation</h3>
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        className="mt-4 min-h-[140px] w-full rounded-[16px] border border-[#EBE6DF] bg-[#F9F7F4] px-4 py-3 text-sm text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0]"
        placeholder="Exemple : Prépare trois publications Instagram par semaine, mais ne publie rien sans mon accord."
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onGenerate} disabled={!prompt.trim()} className="rounded-[10px] bg-[#2B1A4A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Générer le flow</button>
        {summary ? (
          <>
            <button type="button" onClick={onActivate} className="rounded-[10px] border border-[#EBE6DF] px-4 py-2 text-sm font-semibold text-[#17131F]">Activer</button>
            <button type="button" onClick={onRegenerate} className="rounded-[10px] border border-[#EBE6DF] px-4 py-2 text-sm font-semibold text-[#17131F]">Régénérer</button>
            <button type="button" onClick={onCancel} className="rounded-[10px] border border-[#F1D5D0] px-4 py-2 text-sm font-semibold text-[#C2492F]">Annuler</button>
          </>
        ) : null}
      </div>
      {summary ? (
        <div className="mt-4 rounded-[18px] bg-[#F1ECFB] p-4 text-[13px] leading-6 text-[#4C3C77]">
          <span className="font-bold text-[#2B1A4A]">Hans a compris :</span> {summary}
        </div>
      ) : null}
    </section>
  );
}

