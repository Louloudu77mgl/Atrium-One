"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { HansAvatar } from "@/components/hans-avatar";
import { getRcuTypeDefinition, type RcuProgram } from "@/lib/rcu";
import type { RcuLoyaltySnapshot } from "@/lib/rcu-loyalty";
import type { RcuGameRecord, RcuWalletRecord } from "@/lib/rcu-store";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";

type BrandStyle = CSSProperties & {
  "--rcu-primary": string;
  "--rcu-secondary": string;
  "--rcu-accent": string;
  "--rcu-font": string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-[var(--rcu-primary)] px-5 py-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Validation en cours…" : label}
    </button>
  );
}

function PointsVisual({ program, play, loyalty }: { program: RcuProgram; play: RcuGameRecord | null; loyalty: RcuLoyaltySnapshot | null }) {
  const result = play?.result;
  const rewards = [...(program.game_config.rewards ?? [])].sort((left, right) => left.points - right.points);
  const total = loyalty?.pointsBalance ?? result?.pointsTotal ?? 0;
  const next = rewards.find((reward) => reward.points > total);
  const progressTarget = next?.points ?? rewards.at(-1)?.points ?? 100;
  const progress = Math.min(100, Math.round((total / progressTarget) * 100));

  return (
    <div className="rounded-[28px] bg-white/90 p-5 shadow-xl shadow-black/5">
      <div className="flex items-end justify-between gap-4">
        <div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--rcu-primary)]">Solde fidélité</div><div className="mt-1 text-5xl font-black text-slate-950">{total}<span className="ml-2 text-lg text-slate-500">pts</span></div></div>
        <div className="rounded-2xl bg-[var(--rcu-secondary)] px-4 py-3 text-center"><div className="text-2xl font-black text-[var(--rcu-primary)]">+{program.game_config.visitPoints ?? 10}</div><div className="text-[11px] font-bold text-slate-600">par visite</div></div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--rcu-accent)] transition-all duration-700" style={{ width: `${progress}%` }} /></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {rewards.map((reward) => <div key={`${reward.points}-${reward.label}`} className={`rounded-xl border px-3 py-2 text-xs font-bold ${total >= reward.points ? "border-[var(--rcu-accent)] bg-[var(--rcu-secondary)] text-[var(--rcu-primary)]" : "border-slate-200 text-slate-500"}`}>{reward.points} pts · {reward.label}</div>)}
      </div>
    </div>
  );
}

function WheelVisual({ program, play }: { program: RcuProgram; play: RcuGameRecord | null }) {
  const prizes = program.game_config.wheelPrizes ?? [];
  const segmentAngle = 360 / Math.max(prizes.length, 1);
  const prizeIndex = play?.result.wheelPrizeIndex ?? Math.max(0, prizes.findIndex((prize) => prize.label === play?.result.wheelPrize));
  const finalRotation = 1440 + (360 - (prizeIndex + 0.5) * segmentAngle);
  const colors = ["var(--rcu-primary)", "#7c3aed", "#f59e0b", "#111827", "#0f766e", "#dc2626"];
  const wheelGradient = prizes.length
    ? `conic-gradient(${prizes.map((_, index) => `${colors[index % colors.length]} ${index * segmentAngle}deg ${(index + 1) * segmentAngle}deg`).join(", ")})`
    : "conic-gradient(var(--rcu-primary), var(--rcu-accent))";

  return (
    <div className="relative mx-auto h-[292px] w-[292px]">
      <style>{`@keyframes rcu-wheel-result { from { transform: rotate(0deg); } to { transform: rotate(${finalRotation}deg); } } @keyframes rcu-wheel-idle { to { transform: rotate(360deg); } }`}</style>
      <div className="absolute left-1/2 top-[-8px] z-10 h-0 w-0 -translate-x-1/2 border-x-[16px] border-t-[30px] border-x-transparent border-t-white drop-shadow-lg" />
      <div
        className="absolute inset-2 rounded-full border-[10px] border-white shadow-2xl"
        style={{
          background: wheelGradient,
          animation: play ? "rcu-wheel-result 2.6s cubic-bezier(.12,.72,.16,1) both" : "rcu-wheel-idle 14s linear infinite"
        }}
      />
      <div className="absolute inset-[112px] z-10 flex items-center justify-center rounded-full border-4 border-white bg-slate-950 text-center text-xs font-black text-white shadow-lg">HANS</div>
      {prizes.map((prize, index) => {
        const angle = (index + 0.5) * segmentAngle;
        const radians = (angle * Math.PI) / 180;
        const left = 50 + Math.sin(radians) * 35;
        const top = 50 - Math.cos(radians) * 35;
        const shortLabel = prize.label.toLowerCase().includes("retentez") || prize.label.toLowerCase().includes("rien")
          ? "Rejouez"
          : prize.label.replace(/un |une | offert(e)?/gi, "").trim();
        return <div key={`${prize.label}-${index}`} className="absolute z-10 w-20 -translate-x-1/2 -translate-y-1/2 text-center text-[10px] font-black leading-tight text-white drop-shadow" style={{ left: `${left}%`, top: `${top}%` }}>{shortLabel}</div>;
      })}
    </div>
  );
}

function RaffleVisual({ program, play }: { program: RcuProgram; play: RcuGameRecord | null }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border-2 border-dashed border-[var(--rcu-accent)] bg-white p-6 text-center shadow-xl">
      <div className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[var(--rcu-secondary)]" /><div className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[var(--rcu-secondary)]" />
      <div className="text-xs font-black uppercase tracking-[0.2em] text-[var(--rcu-primary)]">Tombola mensuelle</div>
      <div className="mt-3 text-3xl font-black text-slate-950">{program.game_config.rafflePrize ?? "Le lot du mois"}</div>
      <div className="mx-auto my-5 h-px max-w-xs border-t border-dashed border-slate-300" />
      <div className="font-mono text-lg font-black tracking-wider text-[var(--rcu-primary)]">{play?.result.raffleTicket ?? "1 SCAN = 1 TICKET"}</div>
    </div>
  );
}

function StampsVisual({ program, play }: { program: RcuProgram; play: RcuGameRecord | null }) {
  const target = play?.result.stampTarget ?? program.game_config.stampTarget ?? 5;
  const count = play?.result.stampCount ?? 0;
  return (
    <div className="rounded-[28px] bg-white p-6 shadow-xl">
      <div className="flex flex-wrap justify-center gap-3">{Array.from({ length: target }, (_, index) => <div key={index} className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-xl font-black ${index < count ? "border-[var(--rcu-primary)] bg-[var(--rcu-primary)] text-white" : "border-dashed border-slate-300 text-slate-300"}`}>{index < count ? "✓" : index + 1}</div>)}</div>
      <div className="mt-5 text-center text-sm font-bold text-slate-600">{program.game_config.stampReward ?? "Votre cadeau fidélité"} à la {target}e visite</div>
    </div>
  );
}

function HansVisual({ play }: { play: RcuGameRecord | null }) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-xl">
      <div className="flex items-center gap-4"><HansAvatar size={58} /><div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--rcu-primary)]">Analyse Hans</div><div className="mt-1 text-xl font-black text-slate-950">Votre fidélité devient intelligente</div></div></div>
      <p className="mt-5 rounded-2xl bg-[var(--rcu-secondary)] p-4 text-sm font-semibold leading-6 text-slate-700">{play?.result.hansRecommendation ?? "Hans apprend votre fréquence de visite et active automatiquement les bonus les plus pertinents."}</p>
    </div>
  );
}

function GameVisual({ program, play, progressPlay, loyalty }: { program: RcuProgram; play: RcuGameRecord | null; progressPlay: RcuGameRecord | null; loyalty: RcuLoyaltySnapshot | null }) {
  if (program.form_type === "points") return <PointsVisual program={program} play={play} loyalty={loyalty} />;
  if (program.form_type === "wheel") return <WheelVisual program={program} play={play} />;
  if (program.form_type === "raffle") return <RaffleVisual program={program} play={play} />;
  if (program.form_type === "stamps") return <StampsVisual program={program} play={play ?? progressPlay} />;
  return <HansVisual play={play ?? progressPlay} />;
}

export function RcuGameExperience({
  program,
  merchant,
  brandSettings,
  play,
  progressPlay,
  loyalty,
  wallet,
  alreadyPlayedToday,
  walletHref,
  errorMessage,
  submitAction
}: {
  program: RcuProgram;
  merchant: MerchantRow | null;
  brandSettings: MerchantBrandSettingsRow | null;
  play: RcuGameRecord | null;
  progressPlay: RcuGameRecord | null;
  loyalty: RcuLoyaltySnapshot | null;
  wallet: RcuWalletRecord | null;
  alreadyPlayedToday: boolean;
  walletHref: string | null;
  errorMessage?: string;
  submitAction: (formData: FormData) => Promise<void>;
}) {
  const type = getRcuTypeDefinition(program.form_type);
  const style: BrandStyle = {
    "--rcu-primary": brandSettings?.primary_color ?? "#4C1D95",
    "--rcu-secondary": brandSettings?.secondary_color ?? "#F3E8FF",
    "--rcu-accent": brandSettings?.accent_color ?? "#A855F7",
    "--rcu-font": brandSettings?.social_font_family ?? "Inter",
    fontFamily: "var(--rcu-font)"
  };

  return (
    <main className="min-h-screen bg-[var(--rcu-secondary)] px-4 py-6 text-slate-950 sm:py-10" style={style}>
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-white/70 bg-white/75 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            {merchant?.logo_url ? <img src={merchant.logo_url} alt={`Logo ${merchant.business_name}`} className="h-12 w-12 rounded-2xl object-contain" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rcu-primary)] text-xl font-black text-white">{merchant?.business_name?.slice(0, 1) ?? "H"}</div>}
            <div><div className="font-black">{merchant?.business_name ?? "Votre boutique"}</div><div className="text-xs font-semibold text-slate-500">{merchant?.city ?? "Programme fidélité"}</div></div>
          </div>
          {walletHref ? <Link href={walletHref} className="rounded-full bg-[var(--rcu-secondary)] px-3 py-1.5 text-xs font-black text-[var(--rcu-primary)]">Mon portefeuille</Link> : <div className="rounded-full bg-[var(--rcu-secondary)] px-3 py-1.5 text-xs font-black text-[var(--rcu-primary)]">{type.shortLabel}</div>}
        </header>

        <section className="overflow-hidden rounded-[36px] bg-gradient-to-br from-[var(--rcu-primary)] via-[var(--rcu-primary)] to-[var(--rcu-accent)] p-5 shadow-2xl sm:p-8">
          <div className="mb-6 text-center text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{type.label}</p><h1 className="mx-auto mt-3 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">{program.title}</h1><p className="mx-auto mt-3 max-w-lg text-sm font-medium leading-6 text-white/80">{program.incentive_text}</p></div>
          <GameVisual program={program} play={play} progressPlay={progressPlay} loyalty={loyalty} />
        </section>

        {errorMessage ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</div> : null}

        {alreadyPlayedToday && play ? (
          <section className="mt-5 rounded-[28px] border border-white bg-white p-6 text-center shadow-lg">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--rcu-primary)]">Participation enregistrée</div>
            <h2 className="mt-2 text-2xl font-black">{play.result.message}</h2>
            {play.result.unlockedRewards?.length ? <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-black text-amber-800">🎁 Débloqué : {play.result.unlockedRewards.map((reward) => reward.label).join(", ")}</div> : null}
            {play.result.wheelPrize ? <div className="mt-4 text-lg font-black text-[var(--rcu-primary)]">Résultat : {play.result.wheelPrize}</div> : null}
            {play.result.rewardUnlocked ? <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-800">🎁 {play.result.stampReward}</div> : null}
            {walletHref ? <Link href={walletHref} className="mt-5 inline-flex rounded-2xl bg-[var(--rcu-primary)] px-5 py-3 text-sm font-black text-white">Voir mon portefeuille de fidélité</Link> : null}
            <p className="mt-4 text-sm text-slate-500">Cette participation ne peut pas être rejouée aujourd’hui. Revenez lors de votre prochaine visite.</p>
          </section>
        ) : (
          <form action={submitAction} className="mt-5 space-y-4 rounded-[28px] border border-white bg-white p-5 shadow-lg sm:p-6">
            <div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--rcu-primary)]">Valider ma visite</div><h2 className="mt-1 text-2xl font-black">Quelques secondes suffisent</h2></div>
            {wallet ? <div className="rounded-2xl bg-[var(--rcu-secondary)] px-4 py-3 text-sm font-bold text-[var(--rcu-primary)]">Bonjour {wallet.first_name}, votre portefeuille est reconnu sur ce téléphone.</div> : null}
            <div className="grid gap-3 sm:grid-cols-2"><input name="first_name" required defaultValue={wallet?.first_name ?? ""} placeholder="Prénom" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[var(--rcu-primary)]" /><input name="last_name" defaultValue={wallet?.last_name ?? ""} placeholder="Nom" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[var(--rcu-primary)]" /></div>
            <input name="phone" required inputMode="tel" defaultValue={wallet?.phone ?? ""} placeholder="Téléphone" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[var(--rcu-primary)]" />
            <input name="email" required inputMode="email" defaultValue={wallet?.email ?? ""} placeholder="Email" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[var(--rcu-primary)]" />
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">Date de naissance (optionnelle)<input name="birthday" type="date" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none transition focus:border-[var(--rcu-primary)]" /></label>
            <input name="favorite_products" placeholder="Produit préféré (optionnel)" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[var(--rcu-primary)]" />
            {program.game_config.visitValidationEnabled !== false ? <div className="rounded-2xl border-2 border-dashed border-[var(--rcu-accent)]/40 bg-[var(--rcu-secondary)] p-4"><label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--rcu-primary)]">Validation par le commerçant<input type="password" name="visit_code" required minLength={2} maxLength={4} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="mt-2 w-full rounded-xl border border-white bg-white px-4 py-3 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] outline-none" placeholder="••••" /></label><p className="mt-2 text-xs font-semibold text-slate-600">Présentez votre téléphone au commerçant pour qu’il valide votre visite.</p></div> : null}
            {program.form_type === "points" && program.target_url ? <div className="rounded-2xl border border-[var(--rcu-accent)]/30 bg-[var(--rcu-secondary)] p-4"><a href={program.target_url} target="_blank" rel="noreferrer" className="font-black text-[var(--rcu-primary)] underline underline-offset-4">Laisser un avis (+{program.game_config.reviewBonus ?? 100} points)</a><label className="mt-3 flex items-start gap-3 text-sm font-semibold text-slate-700"><input name="review_confirmed" type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--rcu-primary)]" /><span>Le commerçant confirme que l’avis a bien été publié.</span></label></div> : null}
            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium leading-5 text-slate-600"><input name="privacy_consent" type="checkbox" required className="mt-0.5 h-4 w-4 accent-[var(--rcu-primary)]" /><span>J’accepte que {merchant?.business_name ?? "la boutique"} utilise ces informations pour gérer ma participation et mon programme de fidélité.</span></label>
            <label className="flex items-start gap-3 px-1 text-xs font-medium leading-5 text-slate-600"><input name="consent_sms" type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--rcu-primary)]" /><span>Je souhaite recevoir les offres et actualités de la boutique par SMS (facultatif).</span></label>
            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium leading-5 text-slate-600"><input name="consent_email" type="checkbox" required className="mt-0.5 h-4 w-4 accent-[var(--rcu-primary)]" /><span>Je souhaite recevoir les offres et actualités de la boutique par e-mail. Cette case est obligatoire pour participer au jeu RCU.</span></label>
            <SubmitButton label={program.cta_label ?? type.defaultCtaLabel} />
          </form>
        )}
        <footer className="py-6 text-center text-xs font-semibold text-slate-500">Expérience fidélité propulsée par Hans</footer>
      </div>
    </main>
  );
}
