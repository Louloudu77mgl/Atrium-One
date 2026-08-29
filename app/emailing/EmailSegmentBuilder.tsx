"use client";

import { useEffect, useState } from "react";
import { EMAIL_SEGMENT_DEFINITIONS, getEmailAudiencePreview, getEmailSegmentLabel } from "@/lib/emailing-segments";
import type { EmailSegmentMode, EmailSegmentRule, EmailSubscriberProfile } from "@/lib/emailing-types";
import { fieldStyles, surfaceStyles } from "@/lib/design-system";

export function EmailSegmentBuilder({
  subscribers,
  rules,
  mode,
  onRulesChange,
  onModeChange
}: {
  subscribers: EmailSubscriberProfile[];
  rules: EmailSegmentRule[];
  mode: EmailSegmentMode;
  onRulesChange: (rules: EmailSegmentRule[]) => void;
  onModeChange: (mode: EmailSegmentMode) => void;
}) {
  const audience = getEmailAudiencePreview(subscribers, rules, mode);
  const [savedSegments, setSavedSegments] = useState<Array<{ id: string; name: string; description: string | null; rules: { combinator: "AND" | "OR"; rules: EmailSegmentRule[] } }>>([]);
  const [segmentName, setSegmentName] = useState("");
  const [segmentNotice, setSegmentNotice] = useState("");

  useEffect(() => {
    void fetch("/api/customer-segments").then(async (response) => {
      const payload = await response.json() as { segments?: Array<{ id: string; name: string; description: string | null; rules: { combinator: "AND" | "OR"; rules: EmailSegmentRule[] } }> };
      if (response.ok && payload.segments) setSavedSegments(payload.segments);
    }).catch(() => undefined);
  }, []);

  function toggleRule(id: EmailSegmentRule["id"]) {
    const current = rules.find((rule) => rule.id === id);
    if (current) return onRulesChange(rules.filter((rule) => rule.id !== id));
    const definition = EMAIL_SEGMENT_DEFINITIONS.find((item) => item.id === id);
    onRulesChange([...rules, { id, value: definition?.defaultValue }]);
  }

  function updateValue(id: EmailSegmentRule["id"], value: number | string) {
    onRulesChange(rules.map((rule) => rule.id === id ? { ...rule, value } : rule));
  }

  async function saveSegment() {
    if (!segmentName.trim() || rules.length === 0) return;
    setSegmentNotice("");
    const response = await fetch("/api/customer-segments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: segmentName, rules, mode }) });
    const payload = await response.json() as { segment?: { id: string; name: string; description: string | null; rules: { combinator: "AND" | "OR"; rules: EmailSegmentRule[] } }; error?: string };
    if (!response.ok || !payload.segment) { setSegmentNotice(payload.error ?? "Impossible d’enregistrer ce segment."); return; }
    setSavedSegments((current) => [payload.segment!, ...current]);
    setSegmentName("");
    setSegmentNotice("Segment enregistré.");
  }

  return (
    <div className="space-y-5">
      <div className={`${surfaceStyles.subtle} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
        <div><div className="text-xs font-black uppercase tracking-[0.1em] text-[#7C3AED]">Audience calculée</div><div className="mt-1 text-2xl font-black text-[#211432]">{audience.matching.length} client{audience.matching.length > 1 ? "s" : ""}</div><div className="mt-1 text-xs font-semibold text-[#6B617F]">{audience.eligible.length} e-mail{audience.eligible.length > 1 ? "s" : ""} éligible{audience.eligible.length > 1 ? "s" : ""}</div></div>
        {rules.length > 1 ? <div className="flex rounded-xl border border-[#E9D5FF] bg-white p-1 text-xs font-black"><button type="button" onClick={() => onModeChange("all")} className={`rounded-lg px-3 py-2 ${mode === "all" ? "bg-[#4C1D95] text-white" : "text-[#6B617F]"}`}>ET</button><button type="button" onClick={() => onModeChange("any")} className={`rounded-lg px-3 py-2 ${mode === "any" ? "bg-[#4C1D95] text-white" : "text-[#6B617F]"}`}>OU</button></div> : null}
      </div>
      <section className="rounded-2xl border border-[#E9E1F0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-black text-[#211432]">Mes segments</div><div className="mt-1 text-xs font-medium text-[#7A7188]">Enregistrez vos critères pour les réutiliser dans une prochaine campagne.</div></div><div className="flex gap-2"><input value={segmentName} onChange={(event) => setSegmentName(event.target.value)} placeholder="Ex. Fans de pâtisserie" className={`${fieldStyles.input} h-9 w-48 px-3 py-2 text-xs`} /><button type="button" onClick={() => void saveSegment()} disabled={!segmentName.trim() || rules.length === 0} className="rounded-lg bg-[#4C1D95] px-3 py-2 text-xs font-black text-white disabled:opacity-40">Enregistrer</button></div></div>
        {savedSegments.length ? <div className="mt-3 flex flex-wrap gap-2">{savedSegments.map((segment) => <button key={segment.id} type="button" onClick={() => { onRulesChange(segment.rules.rules); onModeChange(segment.rules.combinator === "OR" ? "any" : "all"); }} className="rounded-full border border-[#DCCEF2] bg-[#F8F5FF] px-3 py-2 text-xs font-bold text-[#4C1D95] hover:border-[#7C3AED]">{segment.name}</button>)}</div> : null}
        {segmentNotice ? <div className="mt-3 text-xs font-semibold text-[#6B617F]">{segmentNotice}</div> : null}
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {EMAIL_SEGMENT_DEFINITIONS.map((definition) => {
          const selected = rules.find((rule) => rule.id === definition.id);
          return (
            <div key={definition.id} className={`ao-card-subtle p-4 ${selected ? "border-[var(--color-primary-hover)] bg-[var(--color-primary-muted)] shadow-sm" : ""}`}>
              <button type="button" onClick={() => toggleRule(definition.id)} className="flex w-full items-start gap-3 text-left">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-black ${selected ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-[#CFC7DA] text-transparent"}`}>✓</span>
                <span><span className="block text-sm font-black text-[#211432]">{definition.label}</span><span className="mt-1 block text-xs font-medium leading-5 text-[#7A7188]">{definition.description}</span></span>
              </button>
              {selected && definition.valueLabel ? <label className="mt-3 flex items-center gap-2 border-t border-[var(--color-border)] pt-3 text-xs font-bold text-[var(--color-text-muted)]"><input type={definition.input === "text" ? "text" : "number"} min={definition.input === "text" ? undefined : 1} max={definition.input === "text" ? undefined : 365} value={selected.value ?? definition.defaultValue ?? ""} placeholder={definition.input === "text" ? "Ex. pâtisserie" : undefined} onChange={(event) => updateValue(definition.id, definition.input === "text" ? event.target.value : Number(event.target.value))} className={`${fieldStyles.input} h-8 ${definition.input === "text" ? "w-40" : "w-20"} px-2 py-1.5`} />{definition.valueLabel}</label> : null}
            </div>
          );
        })}
      </div>
      {rules.length ? <div className="rounded-xl border border-[#E9D5FF] bg-white px-4 py-3 text-xs font-semibold text-[#6B617F]"><b className="text-[#211432]">Résumé :</b> {getEmailSegmentLabel(rules, mode)}</div> : null}
      {rules.length ? <div className="grid gap-2 text-xs font-semibold sm:grid-cols-3"><div className="rounded-xl bg-[#F8F5FF] px-3 py-2 text-[#4C1D95]">{audience.eligible.length} seront contactés</div><div className="rounded-xl bg-[#FFF8E8] px-3 py-2 text-[#8A5A12]">{audience.missingConsent} sans consentement</div><div className="rounded-xl bg-[#F5F2F8] px-3 py-2 text-[#6B617F]">{audience.missingEmail} sans e-mail valide</div></div> : null}
    </div>
  );
}
