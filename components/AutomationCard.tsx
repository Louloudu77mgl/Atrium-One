"use client";

import { useMemo, useState } from "react";

type AutomationCardProps = {
  title: string;
  description: string;
  enabledLabel: string;
  disabledLabel: string;
  initialEnabled: boolean;
  settingKey: "reviews_auto_reply_enabled" | "social_auto_publish_enabled";
  initialPostsPerCycle?: number;
  initialCycleWeeks?: number;
  showFrequency?: boolean;
};

export function AutomationCard({
  title,
  description,
  enabledLabel,
  disabledLabel,
  initialEnabled,
  settingKey,
  initialPostsPerCycle = 1,
  initialCycleWeeks = 1,
  showFrequency = false
}: AutomationCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [postsPerCycle, setPostsPerCycle] = useState(initialPostsPerCycle);
  const [cycleWeeks, setCycleWeeks] = useState(initialCycleWeeks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modeLabel = useMemo(() => {
    if (showFrequency) {
      return enabled ? `Automatique · ${postsPerCycle} post${postsPerCycle > 1 ? "s" : ""} toutes les ${cycleWeeks} semaine${cycleWeeks > 1 ? "s" : ""}` : "Manuel";
    }

    return enabled ? "Automatique" : "Manuel";
  }, [cycleWeeks, enabled, postsPerCycle, showFrequency]);

  async function save(next: { enabled?: boolean; postsPerCycle?: number; cycleWeeks?: number }) {
    const nextEnabled = next.enabled ?? enabled;
    const nextPostsPerCycle = next.postsPerCycle ?? postsPerCycle;
    const nextCycleWeeks = next.cycleWeeks ?? cycleWeeks;

    setSaving(true);
    setError(null);

    const previous = { enabled, postsPerCycle, cycleWeeks };
    setEnabled(nextEnabled);
    setPostsPerCycle(nextPostsPerCycle);
    setCycleWeeks(nextCycleWeeks);

    const response = await fetch("/api/settings/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [settingKey]: nextEnabled,
        ...(showFrequency
          ? {
              social_posts_per_cycle: nextPostsPerCycle,
              social_cycle_weeks: nextCycleWeeks
            }
          : {})
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setEnabled(previous.enabled);
      setPostsPerCycle(previous.postsPerCycle);
      setCycleWeeks(previous.cycleWeeks);
      setError(data.error ?? "Impossible d’enregistrer.");
    }

    setSaving(false);
  }

  return (
    <section className="rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-black text-[#7C3AED]">{modeLabel}</div>
          <h2 className="text-xl font-black text-[#211432]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#6B617F]">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-busy={saving}
          onClick={() => void save({ enabled: !enabled })}
          className={`ao-toggle ${enabled ? "ao-toggle-on" : "ao-toggle-off"} ${saving ? "opacity-70" : ""}`}
        >
          <span className={`ao-toggle-thumb ${enabled ? "ao-toggle-thumb-on" : "ao-toggle-thumb-off"}`} />
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-[#FBFAFF] p-4">
        <div className="text-sm font-semibold text-[#211432]">{enabled ? enabledLabel : disabledLabel}</div>
        {showFrequency ? (
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8B7AA8]">Nombre de posts</span>
              <input
                type="number"
                min={1}
                max={30}
                value={String(postsPerCycle)}
                disabled={!enabled || saving}
                onChange={(event) => void save({ postsPerCycle: Number(event.target.value) })}
                className="w-full rounded-lg border border-[#E9D5FF] px-3 py-2 text-sm font-semibold text-[#211432] outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8B7AA8]">Période en semaines</span>
              <input
                type="number"
                min={1}
                max={12}
                value={String(cycleWeeks)}
                disabled={!enabled || saving}
                onChange={(event) => void save({ cycleWeeks: Number(event.target.value) })}
                className="w-full rounded-lg border border-[#E9D5FF] px-3 py-2 text-sm font-semibold text-[#211432] outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <div className="md:col-span-2 text-xs text-[#8B7AA8]">
              Hans publiera {postsPerCycle} post{postsPerCycle > 1 ? "s" : ""} toutes les {cycleWeeks} semaine{cycleWeeks > 1 ? "s" : ""}.
            </div>
          </div>
        ) : null}
        {saving ? <div className="mt-2 text-xs text-[#8B7AA8]">Sauvegarde en cours…</div> : null}
        {error ? <div className="mt-2 text-xs text-[#DC2626]">{error}</div> : null}
      </div>
    </section>
  );
}
