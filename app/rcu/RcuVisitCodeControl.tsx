"use client";

import { useState } from "react";
import { buttonStyles } from "@/lib/design-system";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { RcuProgram } from "@/lib/rcu";

export function RcuVisitCodeControl({ program, onUpdated }: { program: RcuProgram; onUpdated: (program: RcuProgram) => void }) {
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentCode = program.game_config.visitValidationCode ?? "—";

  async function updateCode(regenerate = false) {
    setSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetchWithTimeout(`/api/rcu/forms/${program.slug}/visit-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regenerate ? {} : { code })
      });
      const data = (await response.json()) as { form?: RcuProgram; error?: string };
      if (!response.ok || !data.form) throw new Error(data.error ?? "Modification impossible.");
      onUpdated(data.form);
      setCode("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Modification impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-[18px] border border-[#E4DBF6] bg-[#FBFAFF] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-xs font-black uppercase tracking-[0.1em] text-[#6E4DE0]">Code commerçant actif</div><div className="mt-1 font-mono text-3xl font-black tracking-[0.25em] text-[#211432]">{currentCode}</div></div>
        <div className="text-xs font-semibold leading-5 text-[#6B617F] sm:max-w-[250px]">Valide tant que le RCU reste actif · aucune expiration.</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))} placeholder="Nouveau code" maxLength={4} className="ao-input ao-focus min-w-0 flex-1 px-3.5 py-2.5 font-mono text-sm uppercase" />
        <button type="button" disabled={saving || code.length < 2} onClick={() => void updateCode(false)} className={buttonStyles.secondary}>Appliquer</button>
        <button type="button" disabled={saving} onClick={() => void updateCode(true)} className={buttonStyles.tertiary}>{saving ? "Mise à jour…" : "Générer"}</button>
      </div>
      {errorMessage ? <p className="mt-2 text-xs font-bold text-[#B42318]">{errorMessage}</p> : null}
    </div>
  );
}
