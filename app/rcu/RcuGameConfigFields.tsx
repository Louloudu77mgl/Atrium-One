"use client";

import type { RcuFormType, RcuGameConfig } from "@/lib/rcu";

function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <label className="text-xs font-bold text-[var(--color-text-muted)]">
      {label}
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value) || min)} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm" />
    </label>
  );
}

export function RcuGameConfigFields({ type, config, onChange }: { type: RcuFormType; config: RcuGameConfig; onChange: (config: RcuGameConfig) => void }) {
  if (type === "points") {
    const rewards = config.rewards ?? [];
    return (
      <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
        <div className="mb-3 text-sm font-black text-[var(--color-text)]">Règles du programme</div>
        <div className="grid gap-3 md:grid-cols-3">
          <NumberField label="Points par visite" value={config.visitPoints ?? 10} onChange={(value) => onChange({ ...config, visitPoints: value })} />
          <NumberField label="Bonus 5 jours" value={config.fiveDayBonus ?? 50} onChange={(value) => onChange({ ...config, fiveDayBonus: value })} />
          <NumberField label="Bonus avis" value={config.reviewBonus ?? 100} onChange={(value) => onChange({ ...config, reviewBonus: value })} />
        </div>
        <div className="mt-3 grid gap-2">
          {rewards.map((reward, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
              <input type="number" min={1} value={reward.points} onChange={(event) => onChange({ ...config, rewards: rewards.map((item, itemIndex) => itemIndex === index ? { ...item, points: Number(event.target.value) || 1 } : item) })} className="ao-input ao-focus px-3.5 py-2.5 text-sm" />
              <input value={reward.label} onChange={(event) => onChange({ ...config, rewards: rewards.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} className="ao-input ao-focus px-3.5 py-2.5 text-sm" placeholder="Récompense" />
              <button type="button" onClick={() => onChange({ ...config, rewards: rewards.filter((_, itemIndex) => itemIndex !== index) })} disabled={rewards.length <= 1} className="rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-black text-[var(--color-text-muted)] disabled:opacity-40" aria-label={`Supprimer ${reward.label}`}>×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onChange({ ...config, rewards: [...rewards, { points: (rewards.at(-1)?.points ?? 0) + 100, label: "Nouvelle récompense" }] })} disabled={rewards.length >= 10} className="mt-3 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-black text-[var(--color-text)] disabled:opacity-40">+ Ajouter une récompense</button>
        <p className="mt-3 text-xs font-semibold text-[var(--color-text-muted)]">Le bonus de fréquence est accordé à chaque série de 5 jours de visite différents.</p>
      </div>
    );
  }

  if (type === "wheel") {
    const prizes = config.wheelPrizes ?? [];
    const totalWeight = prizes.reduce((sum, prize) => sum + Math.max(0, prize.weight), 0);
    return (
      <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
        <div className="mb-3 text-sm font-black text-[var(--color-text)]">Cases de la roue et probabilités</div>
        <div className="grid gap-2">
          {prizes.map((prize, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_120px_70px_auto] md:items-center">
              <input value={prize.label} onChange={(event) => onChange({ ...config, wheelPrizes: prizes.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} className="ao-input ao-focus px-3.5 py-2.5 text-sm" />
              <input type="number" min={1} value={prize.weight} onChange={(event) => onChange({ ...config, wheelPrizes: prizes.map((item, itemIndex) => itemIndex === index ? { ...item, weight: Number(event.target.value) || 1 } : item) })} className="ao-input ao-focus px-3.5 py-2.5 text-sm" title="Poids de probabilité" />
              <span className="text-right text-xs font-black text-[var(--color-text-muted)]">{totalWeight ? Math.round((prize.weight / totalWeight) * 100) : 0} %</span>
              <button type="button" onClick={() => onChange({ ...config, wheelPrizes: prizes.filter((_, itemIndex) => itemIndex !== index) })} disabled={prizes.length <= 2} className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-black text-[var(--color-text-muted)] disabled:opacity-40" aria-label={`Supprimer ${prize.label}`}>×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onChange({ ...config, wheelPrizes: [...prizes, { label: "Nouveau gain", weight: 5 }] })} disabled={prizes.length >= 12} className="mt-3 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-black text-[var(--color-text)] disabled:opacity-40">+ Ajouter une case</button>
        <p className="mt-3 text-xs font-semibold text-[var(--color-text-muted)]">Les pourcentages sont calculés automatiquement à partir des poids. Les gains restent disponibles jusqu’à leur validation en boutique.</p>
      </div>
    );
  }

  if (type === "raffle") {
    return <label className="text-xs font-bold text-[var(--color-text-muted)]">Lot mensuel<input value={config.rafflePrize ?? ""} onChange={(event) => onChange({ ...config, rafflePrize: event.target.value })} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm" placeholder="Panier garni, bouquet, repas…" /><span className="mt-2 block font-semibold">Chaque visite validée crée un ticket unique. Le tirage mensuel se fait ensuite depuis la carte du RCU.</span></label>;
  }

  if (type === "stamps") {
    return (
      <div className="grid gap-3 md:grid-cols-[160px_1fr]">
        <NumberField label="Nombre de visites" min={2} max={30} value={config.stampTarget ?? 5} onChange={(value) => onChange({ ...config, stampTarget: Math.max(2, value) })} />
        <label className="text-xs font-bold text-[var(--color-text-muted)]">Cadeau débloqué<input value={config.stampReward ?? ""} onChange={(event) => onChange({ ...config, stampReward: event.target.value })} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm" /></label>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <NumberField label="Points de base" min={1} value={config.visitPoints ?? 10} onChange={(value) => onChange({ ...config, visitPoints: value })} />
        <NumberField label="Inactivité déclenchante" min={1} max={365} value={config.inactivityDays ?? 25} onChange={(value) => onChange({ ...config, inactivityDays: value })} />
        <NumberField label="Multiplicateur" min={1} max={5} value={config.inactivityMultiplier ?? 2} onChange={(value) => onChange({ ...config, inactivityMultiplier: value })} />
      </div>
      <p className="mt-3 text-xs font-semibold text-[var(--color-text-muted)]">Hans détecte l’accueil, la régularité, les habitudes par jour et les retours après inactivité.</p>
    </div>
  );
}
