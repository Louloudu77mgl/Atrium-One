"use client";

import { EMAIL_SEGMENT_DEFINITIONS, filterEmailSubscribers, getEmailSegmentLabel } from "@/lib/emailing-segments";
import type { EmailSegmentMode, EmailSegmentRule, EmailSubscriberProfile } from "@/lib/emailing-types";

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
  const audience = filterEmailSubscribers(subscribers, rules, mode);

  function toggleRule(id: EmailSegmentRule["id"]) {
    const current = rules.find((rule) => rule.id === id);
    if (current) return onRulesChange(rules.filter((rule) => rule.id !== id));
    const definition = EMAIL_SEGMENT_DEFINITIONS.find((item) => item.id === id);
    onRulesChange([...rules, { id, value: definition?.defaultValue }]);
  }

  function updateValue(id: EmailSegmentRule["id"], value: number) {
    onRulesChange(rules.map((rule) => rule.id === id ? { ...rule, value } : rule));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F8F5FF] px-4 py-3">
        <div><div className="text-xs font-black uppercase tracking-[0.1em] text-[#7C3AED]">Audience calculée</div><div className="mt-1 text-2xl font-black text-[#211432]">{audience.length} abonné{audience.length > 1 ? "s" : ""}</div></div>
        {rules.length > 1 ? <div className="flex rounded-xl border border-[#E9D5FF] bg-white p-1 text-xs font-black"><button type="button" onClick={() => onModeChange("all")} className={`rounded-lg px-3 py-2 ${mode === "all" ? "bg-[#4C1D95] text-white" : "text-[#6B617F]"}`}>ET</button><button type="button" onClick={() => onModeChange("any")} className={`rounded-lg px-3 py-2 ${mode === "any" ? "bg-[#4C1D95] text-white" : "text-[#6B617F]"}`}>OU</button></div> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {EMAIL_SEGMENT_DEFINITIONS.map((definition) => {
          const selected = rules.find((rule) => rule.id === definition.id);
          return (
            <div key={definition.id} className={`rounded-2xl border p-4 transition ${selected ? "border-[#7C3AED] bg-[#F8F5FF] shadow-sm" : "border-[#E8E2EF] bg-white hover:border-[#C4B5FD]"}`}>
              <button type="button" onClick={() => toggleRule(definition.id)} className="flex w-full items-start gap-3 text-left">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-black ${selected ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-[#CFC7DA] text-transparent"}`}>✓</span>
                <span><span className="block text-sm font-black text-[#211432]">{definition.label}</span><span className="mt-1 block text-xs font-medium leading-5 text-[#7A7188]">{definition.description}</span></span>
              </button>
              {selected && definition.valueLabel ? <label className="mt-3 flex items-center gap-2 border-t border-[#E9D5FF] pt-3 text-xs font-bold text-[#6B617F]"><input type="number" min={1} max={365} value={selected.value ?? definition.defaultValue} onChange={(event) => updateValue(definition.id, Number(event.target.value))} className="w-20 rounded-lg border border-[#DCD3E7] bg-white px-2 py-1.5 text-[#211432] outline-none focus:border-[#7C3AED]" />{definition.valueLabel}</label> : null}
            </div>
          );
        })}
      </div>
      {rules.length ? <div className="rounded-xl border border-[#E9D5FF] bg-white px-4 py-3 text-xs font-semibold text-[#6B617F]"><b className="text-[#211432]">Résumé :</b> {getEmailSegmentLabel(rules, mode)}</div> : null}
    </div>
  );
}
