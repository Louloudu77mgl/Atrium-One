"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { HansAvatar } from "@/components/hans-avatar";
import { getRcuTypeDefinition, type RcuFormType, type RcuProgram } from "@/lib/rcu";
import type { RcuLoyaltySnapshot } from "@/lib/rcu-loyalty";
import type { RcuGameRecord, RcuWalletRecord } from "@/lib/rcu-store";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";

type BrandStyle = CSSProperties & {
  "--rcu-primary": string;
  "--rcu-secondary": string;
  "--rcu-accent": string;
  "--rcu-font": string;
};

const HIGHLIGHT_TERMS: Record<RcuFormType, string[]> = {
  points: ["points", "point"],
  wheel: ["chance", "roue"],
  raffle: ["ticket", "tombola"],
  stamps: ["récompensée", "récompensé", "fidélité", "visites"],
  smart_hans: ["personnalise", "personnalisée", "intelligente", "récompense"]
};

function HighlightedTitle({ title, type }: { title: string; type: RcuFormType }) {
  const normalizedTitle = title.toLocaleLowerCase("fr");
  const term = HIGHLIGHT_TERMS[type].find((candidate) => normalizedTitle.includes(candidate));
  if (!term) return title;
  const start = normalizedTitle.indexOf(term);
  return (
    <>
      {title.slice(0, start)}
      <span className="bg-[linear-gradient(90deg,var(--rcu-secondary),var(--rcu-accent))] bg-clip-text text-transparent">
        {title.slice(start, start + term.length)}
      </span>
      {title.slice(start + term.length)}
    </>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full overflow-hidden rounded-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--rcu-primary)_32%,#241040),color-mix(in_srgb,var(--rcu-accent)_42%,#241040))] px-5 py-4 text-sm font-black uppercase tracking-[0.04em] text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
    >
      <span className="absolute inset-y-0 -left-1/2 w-2/5 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition duration-700 group-hover:left-[120%]" />
      <span className="relative">{pending ? "Validation en cours…" : label}</span>
    </button>
  );
}

function BrandLogo({ merchant, compact = false }: { merchant: MerchantRow | null; compact?: boolean }) {
  const sizeClass = compact ? "h-12 w-12" : "h-[58px] w-[58px]";
  if (merchant?.logo_url) {
    return (
      <img
        src={merchant.logo_url}
        alt={`Logo ${merchant.business_name}`}
        className={`${sizeClass} rounded-[14px] border border-white/15 bg-white object-contain p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.24)]`}
      />
    );
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-[14px] border border-white/10 bg-white/10 text-xl font-black text-white shadow-inner`}>
      {merchant?.business_name?.trim().slice(0, 1).toUpperCase() || "H"}
    </div>
  );
}

function PointsVisual({ program, play, loyalty }: { program: RcuProgram; play: RcuGameRecord | null; loyalty: RcuLoyaltySnapshot | null }) {
  const result = play?.result;
  const rewards = [...(program.game_config.rewards ?? [])].sort((left, right) => left.points - right.points);
  const total = loyalty?.pointsBalance ?? result?.pointsTotal ?? 0;
  const next = rewards.find((reward) => reward.points > total);
  const progressTarget = next?.points ?? rewards.at(-1)?.points ?? 100;
  const progress = Math.min(100, Math.round((total / Math.max(1, progressTarget)) * 100));

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2 font-black">
          <span className="text-[38px] leading-none text-white">{total}</span>
          <span className="text-sm text-white/55">pts</span>
        </div>
        <div className="rounded-[14px] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--rcu-secondary)_45%,white),color-mix(in_srgb,var(--rcu-accent)_30%,white))] px-3.5 py-2 text-center text-[#171335] shadow-[0_5px_0_rgba(0,0,0,0.25)]">
          <div className="text-base font-black">+{program.game_config.visitPoints ?? 10}</div>
          <div className="text-[9px] font-black uppercase tracking-wide">par visite</div>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-white/5">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--rcu-secondary),var(--rcu-accent))] transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rewards.map((reward) => {
          const unlocked = total >= reward.points;
          return (
            <div
              key={`${reward.points}-${reward.label}`}
              className={`rounded-[13px] border px-2 py-2.5 text-center text-[10px] font-bold leading-[1.3] ${unlocked ? "border-[var(--rcu-secondary)] bg-[color-mix(in_srgb,var(--rcu-secondary)_12%,transparent)] text-white" : "border-white/10 bg-white/[0.04] text-white/50"}`}
            >
              <b className="mb-0.5 block text-xs text-[var(--rcu-secondary)]">{reward.points} pts</b>
              {reward.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WheelVisual({ program, play, merchant }: { program: RcuProgram; play: RcuGameRecord | null; merchant: MerchantRow | null }) {
  const prizes = program.game_config.wheelPrizes ?? [];
  const segmentAngle = 360 / Math.max(prizes.length, 1);
  const prizeIndex = play?.result.wheelPrizeIndex ?? Math.max(0, prizes.findIndex((prize) => prize.label === play?.result.wheelPrize));
  const finalRotation = 1440 + (360 - (prizeIndex + 0.5) * segmentAngle);
  const colors = ["var(--rcu-primary)", "var(--rcu-secondary)", "#100c26", "var(--rcu-accent)", "color-mix(in srgb,var(--rcu-primary) 62%,white)", "color-mix(in srgb,var(--rcu-accent) 72%,black)"];
  const wheelGradient = prizes.length
    ? `conic-gradient(${prizes.map((_, index) => `${colors[index % colors.length]} ${index * segmentAngle}deg ${(index + 1) * segmentAngle}deg`).join(", ")})`
    : "conic-gradient(var(--rcu-primary), var(--rcu-accent))";

  return (
    <div>
      <div className="relative mx-auto h-[224px] w-[224px]">
        <style>{`@keyframes rcu-wheel-result { from { transform: rotate(0deg); } to { transform: rotate(${finalRotation}deg); } }`}</style>
        <div className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--rcu-primary)_45%,transparent),transparent_70%)] opacity-80 motion-safe:animate-pulse" />
        <div className="absolute left-1/2 top-[-8px] z-30 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[19px] border-x-transparent border-t-[var(--rcu-secondary)] drop-shadow-lg" />
        <div
          className="absolute inset-0 rounded-full border-[5px] border-[#171335] shadow-[0_0_0_2px_rgba(255,255,255,0.15),0_14px_34px_rgba(0,0,0,0.38)]"
          style={{ background: wheelGradient, animation: play ? "rcu-wheel-result 2.8s cubic-bezier(.14,.67,.2,1) both" : undefined }}
        >
          {prizes.map((prize, index) => {
            const angle = (index + 0.5) * segmentAngle;
            const shortLabel = prize.label.toLowerCase().includes("retentez") || prize.label.toLowerCase().includes("rien")
              ? "Rejouez"
              : prize.label.replace(/\bun\b|\bune\b|offert(e)?/gi, "").trim();
            return (
              <div
                key={`${prize.label}-${index}`}
                className="absolute left-1/2 top-1/2 w-[70px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/25 px-1 py-0.5 text-center text-[10px] font-black leading-[1.05] text-white drop-shadow-md"
                style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-75px) rotate(${-angle}deg)` }}
              >
                {shortLabel}
              </div>
            );
          })}
        </div>
        <div className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--rcu-secondary)] bg-[#171335] shadow-[0_0_18px_color-mix(in_srgb,var(--rcu-secondary)_45%,transparent)]">
          {merchant?.logo_url ? <img src={merchant.logo_url} alt="" className="h-full w-full bg-white object-contain p-1.5" /> : <span className="text-lg font-black text-white">H</span>}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-black text-white/55">{prizes.length} lots en jeu · 1 lancer par visite</p>
    </div>
  );
}

function RaffleVisual({ program, play, loyalty }: { program: RcuProgram; play: RcuGameRecord | null; loyalty: RcuLoyaltySnapshot | null }) {
  const raffleMonth = play?.result.raffleMonth ?? new Date().toISOString().slice(0, 7);
  const ticketCount = loyalty?.raffleTickets.filter((ticket) => ticket.month === raffleMonth).length ?? play?.result.raffleTicketsTotal ?? 0;
  const ticketNumber = play?.result.raffleTicket?.match(/(\d+)$/)?.[1];

  return (
    <div>
      <div className="flex overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.06]">
        <div className="min-w-0 flex-1 px-3 py-4 text-center">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/45">Tombola mensuelle</div>
          <div className="mt-1.5 text-base font-black leading-tight text-white">{program.game_config.rafflePrize ?? "Le lot du mois"}</div>
          <div className="mt-2.5 text-[10px] font-black tracking-[0.14em] text-[var(--rcu-secondary)]">1 SCAN = 1 TICKET</div>
        </div>
        <div className="relative flex w-[78px] shrink-0 flex-col items-center justify-center border-l-2 border-dashed border-black/20 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--rcu-secondary)_45%,white),color-mix(in_srgb,var(--rcu-accent)_30%,white))] text-[#171335]">
          <b className="text-lg font-black">{ticketNumber ? `#${ticketNumber}` : "#—"}</b>
          <small className="text-[8px] font-black uppercase tracking-wider">Ticket</small>
        </div>
      </div>
      <div className="mt-3 text-center text-xs font-black text-[var(--rcu-secondary)]">{ticketCount} ticket{ticketCount > 1 ? "s" : ""} déjà en jeu ce mois-ci</div>
    </div>
  );
}

function StampsVisual({ program, play }: { program: RcuProgram; play: RcuGameRecord | null }) {
  const target = play?.result.stampTarget ?? program.game_config.stampTarget ?? 5;
  const count = play?.result.stampCount ?? 0;

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: target }, (_, index) => {
          const filled = index < count;
          const next = index === count;
          const reward = index === target - 1;
          return (
            <div
              key={index}
              className={`flex aspect-square min-w-0 items-center justify-center rounded-[15px] border-2 text-sm font-black transition ${filled ? "scale-[1.04] border-[var(--rcu-secondary)] bg-[color-mix(in_srgb,var(--rcu-secondary)_18%,transparent)] text-[var(--rcu-secondary)] shadow-[0_0_16px_color-mix(in_srgb,var(--rcu-secondary)_30%,transparent)]" : next ? "border-[var(--rcu-accent)] text-[var(--rcu-accent)] motion-safe:animate-pulse" : reward ? "border-[var(--rcu-primary)] text-[var(--rcu-accent)]" : "border-dashed border-white/15 text-white/30"}`}
            >
              {filled ? "★" : reward ? "★" : index + 1}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] font-black text-white/55">{program.game_config.stampReward ?? "Votre cadeau fidélité"} à la {target}e visite</p>
    </div>
  );
}

function HansVisual({ play }: { play: RcuGameRecord | null }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-1 py-1 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-[var(--rcu-secondary)] bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] shadow-[0_0_24px_color-mix(in_srgb,var(--rcu-secondary)_38%,transparent)]">
        <span className="absolute -inset-2 rounded-full border border-[var(--rcu-secondary)]/60 motion-safe:animate-ping" />
        <HansAvatar size={58} />
      </div>
      <div className="text-sm font-black text-white">Hans analyse votre rythme</div>
      <div className="min-w-[210px] rounded-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--rcu-primary)_32%,#241040),color-mix(in_srgb,var(--rcu-accent)_42%,#241040))] px-4 py-2 text-xs font-black text-white">
        {play?.result.hansRecommendation ?? "Calcul du bonus le plus pertinent"}
      </div>
      <div className="text-[10px] font-bold text-white/40">L’analyse s’affine à chaque visite validée.</div>
    </div>
  );
}

function GameVisual({ program, play, progressPlay, loyalty, merchant }: { program: RcuProgram; play: RcuGameRecord | null; progressPlay: RcuGameRecord | null; loyalty: RcuLoyaltySnapshot | null; merchant: MerchantRow | null }) {
  if (program.form_type === "points") return <PointsVisual program={program} play={play} loyalty={loyalty} />;
  if (program.form_type === "wheel") return <WheelVisual program={program} play={play} merchant={merchant} />;
  if (program.form_type === "raffle") return <RaffleVisual program={program} play={play} loyalty={loyalty} />;
  if (program.form_type === "stamps") return <StampsVisual program={program} play={play ?? progressPlay} />;
  return <HansVisual play={play ?? progressPlay} />;
}

function getProgramStatus({ program, play, progressPlay, loyalty }: { program: RcuProgram; play: RcuGameRecord | null; progressPlay: RcuGameRecord | null; loyalty: RcuLoyaltySnapshot | null }) {
  if (program.form_type === "points") return `${loyalty?.pointsBalance ?? play?.result.pointsTotal ?? 0} pts`;
  if (program.form_type === "wheel") return play?.result.wheelPrize ? "Gain du jour" : "1 chance";
  if (program.form_type === "raffle") {
    const count = loyalty?.raffleTickets.length ?? play?.result.raffleTicketsTotal ?? 0;
    return `${count} ticket${count > 1 ? "s" : ""}`;
  }
  if (program.form_type === "stamps") {
    const result = play?.result ?? progressPlay?.result;
    return `${result?.stampCount ?? 0}/${result?.stampTarget ?? program.game_config.stampTarget ?? 5} visites`;
  }
  const multiplier = play?.result.hansMultiplier ?? progressPlay?.result.hansMultiplier;
  return multiplier && multiplier > 1 ? `Bonus ×${multiplier}` : "Hans IA";
}

function ResultDetail({ children }: { children: ReactNode }) {
  return <div className="rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-black text-white/85">{children}</div>;
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
  newCustomerHref,
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
  newCustomerHref: string;
  errorMessage?: string;
  submitAction: (formData: FormData) => Promise<void>;
}) {
  const type = getRcuTypeDefinition(program.form_type);
  const style: BrandStyle = {
    "--rcu-primary": brandSettings?.primary_color ?? "#4C1D95",
    "--rcu-secondary": brandSettings?.secondary_color ?? "#F3E8FF",
    "--rcu-accent": brandSettings?.accent_color ?? "#A855F7",
    "--rcu-font": brandSettings?.social_font_family ?? "Inter",
    fontFamily: "var(--rcu-font), Inter, ui-sans-serif, system-ui, sans-serif",
    colorScheme: "dark"
  };
  const fieldClass = "w-full rounded-[12px] border-[1.5px] border-white/10 bg-white/[0.065] px-3 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-[var(--rcu-secondary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--rcu-secondary)_12%,transparent)]";
  const status = getProgramStatus({ program, play, progressPlay, loyalty });

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#050414] px-3 py-6 text-white sm:px-5 sm:py-10"
      style={{
        ...style,
        background: "radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--rcu-primary) 32%, transparent), transparent 36%), radial-gradient(circle at 92% 8%, color-mix(in srgb, var(--rcu-accent) 24%, transparent), transparent 34%), #050414"
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.5) 1px, transparent 1.4px)", backgroundSize: "28px 28px", maskImage: "radial-gradient(ellipse at top, black, transparent 70%)" }} />

      <article
        className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[30px] border border-white/10 px-5 py-5 shadow-[0_34px_80px_-24px_rgba(0,0,0,0.8)] sm:px-6 sm:py-6"
        style={{ background: "radial-gradient(120% 90% at 15% -10%, color-mix(in srgb, var(--rcu-primary) 48%, transparent), transparent 60%), radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--rcu-accent) 32%, transparent), transparent 56%), linear-gradient(180deg, color-mix(in srgb, var(--rcu-primary) 24%, #171335), #0b0a20 58%, #08071a)" }}
      >
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo merchant={merchant} compact />
            <div className="min-w-0">
              <div className="truncate text-sm font-black tracking-tight text-white">{merchant?.business_name ?? "Votre boutique"}</div>
              <div className="mt-0.5 truncate text-[11px] font-semibold text-white/40">{merchant?.city ?? "Programme fidélité"}</div>
            </div>
          </div>
          {walletHref ? (
            <Link href={walletHref} className="shrink-0 rounded-full border border-[var(--rcu-secondary)]/25 bg-[color-mix(in_srgb,var(--rcu-secondary)_9%,transparent)] px-3 py-1.5 text-[11px] font-black text-[var(--rcu-secondary)] transition hover:bg-white/10">
              {status}
            </Link>
          ) : (
            <div className="shrink-0 rounded-full border border-[var(--rcu-secondary)]/25 bg-[color-mix(in_srgb,var(--rcu-secondary)_9%,transparent)] px-3 py-1.5 text-[11px] font-black text-[var(--rcu-secondary)]">{status}</div>
          )}
        </header>

        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rcu-accent)]/30 bg-[color-mix(in_srgb,var(--rcu-accent)_10%,transparent)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--rcu-secondary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--rcu-accent)] shadow-[0_0_8px_var(--rcu-accent)]" />
          {type.label}
        </div>
        <h1 className="mt-3 text-[28px] font-black leading-[1.05] tracking-[-0.025em] text-white">
          <HighlightedTitle title={program.title} type={program.form_type} />
        </h1>
        <p className="mt-2.5 text-[13.5px] font-medium leading-[1.5] text-white/55">{program.incentive_text}</p>

        <div className="mt-5 flex items-start gap-1.5">
          {["Je m’identifie", "Ma visite est validée", "Je profite de mon avantage"].map((step, index) => (
            <div key={step} className="relative flex min-w-0 flex-1 flex-col items-start gap-1.5">
              <span className={`relative z-10 flex h-[23px] w-[23px] items-center justify-center rounded-[8px] text-[10px] font-black ${alreadyPlayedToday ? "bg-[color-mix(in_srgb,var(--rcu-accent)_42%,#241040)] text-white" : index === 0 ? "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--rcu-primary)_32%,#241040),color-mix(in_srgb,var(--rcu-accent)_42%,#241040))] text-white shadow-[0_0_0_4px_color-mix(in_srgb,var(--rcu-primary)_18%,transparent)]" : "border border-white/10 bg-white/[0.06] text-white/45"}`}>{alreadyPlayedToday ? "✓" : index + 1}</span>
              <span className={`pr-1 text-[9.5px] font-bold leading-[1.25] ${alreadyPlayedToday || index === 0 ? "text-white/85" : "text-white/35"}`}>{step}</span>
              {index < 2 ? <span className="absolute left-[31px] right-[-2px] top-[11px] h-px bg-white/10" /> : null}
            </div>
          ))}
        </div>

        <section className="mt-5 rounded-[22px] border border-white/10 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--rcu-secondary)_11%,transparent),rgba(255,255,255,0.025)_60%)] p-4 shadow-inner">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--rcu-secondary)]">Votre avantage</span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white/45">Fidélité</span>
          </div>
          <GameVisual program={program} play={play} progressPlay={progressPlay} loyalty={loyalty} merchant={merchant} />
        </section>

        {errorMessage ? <div className="mt-4 rounded-[14px] border border-red-400/25 bg-red-400/10 px-3.5 py-3 text-xs font-bold leading-5 text-red-100">{errorMessage}</div> : null}

        {alreadyPlayedToday && play ? (
          <section className="mt-5 rounded-[22px] border border-[var(--rcu-secondary)]/20 bg-white/[0.055] p-5 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--rcu-secondary)]">Participation enregistrée</div>
            <h2 className="mt-2 text-[22px] font-black leading-tight text-white">{play.result.message}</h2>
            <div className="mt-4 grid gap-2">
              {play.result.unlockedRewards?.length ? <ResultDetail>🎁 Débloqué : {play.result.unlockedRewards.map((reward) => reward.label).join(", ")}</ResultDetail> : null}
              {play.result.wheelPrize ? <ResultDetail>Résultat : {play.result.wheelPrize}</ResultDetail> : null}
              {play.result.rewardUnlocked ? <ResultDetail>🎁 {play.result.stampReward}</ResultDetail> : null}
            </div>
            {walletHref ? <Link href={walletHref} className="mt-5 inline-flex rounded-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--rcu-primary)_32%,#241040),color-mix(in_srgb,var(--rcu-accent)_42%,#241040))] px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg">Voir mon portefeuille</Link> : null}
            <p className="mx-auto mt-4 max-w-xs text-[10.5px] font-semibold leading-4 text-white/35">Cette participation ne peut pas être rejouée aujourd’hui. Revenez lors de votre prochaine visite.</p>
          </section>
        ) : (
          <form action={submitAction} className="mt-5">
            <div className="text-[10px] font-black uppercase tracking-[0.13em] text-white/35">Mes informations</div>
            <h2 className="mt-1 text-lg font-black tracking-tight text-white">Créer ou retrouver ma fidélité</h2>

            {wallet ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-[13px] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--rcu-primary)_32%,#241040),color-mix(in_srgb,var(--rcu-accent)_42%,#241040))] px-3 py-2.5 text-xs font-bold text-white">
                <span className="min-w-0">Bonjour {wallet.first_name}, votre portefeuille est reconnu.</span>
                <Link href={newCustomerHref} className="shrink-0 rounded-full bg-white/15 px-2.5 py-1.5 text-[10px] font-black">Ce n’est pas moi</Link>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-white/35">Prénom<input name="first_name" required defaultValue={wallet?.first_name ?? ""} placeholder="Prénom" className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-white/35">Nom<input name="last_name" defaultValue={wallet?.last_name ?? ""} placeholder="Nom" className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-white/35">Téléphone<input name="phone" required inputMode="tel" defaultValue={wallet?.phone ?? ""} placeholder="Téléphone" className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-white/35">Adresse e-mail<input name="email" required type="email" inputMode="email" defaultValue={wallet?.email ?? ""} placeholder="E-mail" className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-white/35">Date de naissance<input name="birthday" required type="date" max={new Date().toISOString().slice(0, 10)} className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-white/35">Préférence <span className="normal-case tracking-normal">(optionnelle)</span><input name="favorite_products" placeholder="Produit préféré" className={`${fieldClass} mt-1.5`} /></label>
            </div>

            {program.game_config.visitValidationEnabled !== false ? (
              <div className="mt-4 rounded-[17px] border-[1.5px] border-dashed border-[var(--rcu-secondary)]/35 bg-[color-mix(in_srgb,var(--rcu-secondary)_8%,transparent)] p-3.5">
                <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-[var(--rcu-secondary)]">
                  Validation par le commerçant
                  <input type="password" name="visit_code" required minLength={2} maxLength={4} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="mt-2.5 w-full rounded-[11px] border border-white/10 bg-black/20 px-4 py-2.5 text-center font-mono text-xl font-black uppercase tracking-[0.55em] text-[var(--rcu-secondary)] outline-none focus:border-[var(--rcu-secondary)]" placeholder="••••" />
                </label>
                <p className="mt-2 text-center text-[10px] font-semibold leading-4 text-white/45">Présentez votre téléphone au commerçant pour valider votre visite.</p>
              </div>
            ) : null}

            {program.form_type === "points" && program.target_url ? (
              <div className="mt-3 rounded-[14px] border border-[var(--rcu-secondary)]/20 bg-[color-mix(in_srgb,var(--rcu-secondary)_7%,transparent)] p-3.5">
                <a href={program.target_url} target="_blank" rel="noreferrer" className="text-xs font-black text-[var(--rcu-secondary)] underline underline-offset-4">Laisser un avis (+{program.game_config.reviewBonus ?? 100} points)</a>
                <label className="mt-3 flex items-start gap-2.5 text-[10.5px] font-semibold leading-4 text-white/55"><input name="review_confirmed" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--rcu-primary)]" /><span>Le commerçant confirme que l’avis a bien été publié.</span></label>
              </div>
            ) : null}

            <label className="mt-4 flex items-start gap-2.5 text-[10.5px] font-medium leading-[1.45] text-white/40">
              <input name="consent_all" type="checkbox" required className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--rcu-accent)]" />
              <span>J’accepte que {merchant?.business_name ?? "la boutique"} utilise mes informations pour gérer ma participation et mon programme de fidélité, et m’adresse ses offres par e-mail et par SMS. Je pourrai retirer mon accord à tout moment.</span>
            </label>

            <div className="mt-5"><SubmitButton label={program.cta_label ?? type.defaultCtaLabel} /></div>
          </form>
        )}

        <footer className="mt-5 text-center text-[10px] font-bold tracking-wide text-white/30">Expérience fidélité propulsée par Hans</footer>
      </article>
    </main>
  );
}
