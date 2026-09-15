import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { HansAvatar } from "@/components/hans-avatar";
import { getRcuTypeDefinition, type RcuFormType, type RcuProgram } from "@/lib/rcu";
import { getRcuConsumerBrand } from "@/lib/rcu-brand";
import type { RcuLoyaltySnapshot } from "@/lib/rcu-loyalty";
import type { RcuGameRecord, RcuWalletRecord } from "@/lib/rcu-store";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";
import { RcuSubmitButton } from "./RcuSubmitButton";

type BrandStyle = CSSProperties & {
  "--rcu-primary": string;
  "--rcu-secondary": string;
  "--rcu-accent": string;
  "--rcu-ink": string;
  "--rcu-surface": string;
  "--rcu-soft": string;
  "--rcu-border": string;
  "--rcu-on-primary": string;
  "--rcu-font": string;
  "--rcu-title-font": string;
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
      <span className="bg-[linear-gradient(90deg,var(--rcu-primary),var(--rcu-accent))] bg-clip-text text-transparent">
        {title.slice(start, start + term.length)}
      </span>
      {title.slice(start + term.length)}
    </>
  );
}

function BrandLogo({ merchant, compact = false }: { merchant: MerchantRow | null; compact?: boolean }) {
  const sizeClass = compact ? "h-14 w-14" : "h-[62px] w-[62px]";
  if (merchant?.logo_url) {
    return (
      <img
        src={merchant.logo_url}
        alt={`Logo ${merchant.business_name}`}
        className={`${sizeClass} rounded-[16px] border border-[var(--rcu-border)] bg-white object-contain p-1.5 shadow-[0_8px_22px_rgba(30,25,20,0.08)]`}
      />
    );
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-[16px] border border-[var(--rcu-border)] bg-[var(--rcu-soft)] text-xl font-black text-[var(--rcu-primary)]`}>
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
          <span className="text-[38px] leading-none text-[var(--rcu-ink)]">{total}</span>
          <span className="text-sm text-[color-mix(in_srgb,var(--rcu-ink)_55%,transparent)]">pts</span>
        </div>
        <div className="rounded-[14px] border border-[var(--rcu-border)] bg-white px-3.5 py-2 text-center text-[var(--rcu-ink)] shadow-[0_7px_18px_rgba(35,28,20,0.06)]">
          <div className="text-base font-black">+{program.game_config.visitPoints ?? 10}</div>
          <div className="text-[9px] font-black uppercase tracking-wide">par visite</div>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--rcu-primary)_10%,white)]">
        <div className="h-full rounded-full bg-[var(--rcu-primary)] transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rewards.map((reward) => {
          const unlocked = total >= reward.points;
          return (
            <div
              key={`${reward.points}-${reward.label}`}
              className={`rounded-[13px] border px-2 py-2.5 text-center text-[10px] font-bold leading-[1.3] ${unlocked ? "border-[var(--rcu-primary)] bg-white text-[var(--rcu-ink)]" : "border-[var(--rcu-border)] bg-white/55 text-[color-mix(in_srgb,var(--rcu-ink)_50%,transparent)]"}`}
            >
              <b className="mb-0.5 block text-xs text-[var(--rcu-primary)]">{reward.points} pts</b>
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
  const colors = ["var(--rcu-primary)", "var(--rcu-secondary)", "var(--rcu-accent)", "color-mix(in srgb,var(--rcu-primary) 62%,white)", "color-mix(in srgb,var(--rcu-accent) 54%,white)", "color-mix(in srgb,var(--rcu-primary) 76%,black)"];
  const wheelGradient = prizes.length
    ? `conic-gradient(${prizes.map((_, index) => `${colors[index % colors.length]} ${index * segmentAngle}deg ${(index + 1) * segmentAngle}deg`).join(", ")})`
    : "conic-gradient(var(--rcu-primary), var(--rcu-accent))";

  return (
    <div>
      <div className="relative mx-auto h-[224px] w-[224px]">
        <style>{`@keyframes rcu-wheel-result { from { transform: rotate(0deg); } to { transform: rotate(${finalRotation}deg); } }`}</style>
        <div className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--rcu-primary)_14%,transparent),transparent_70%)]" />
        <div className="absolute left-1/2 top-[-8px] z-30 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[19px] border-x-transparent border-t-[var(--rcu-secondary)] drop-shadow-lg" />
        <div
          className="absolute inset-0 rounded-full border-[5px] border-white shadow-[0_0_0_1px_var(--rcu-border),0_14px_34px_rgba(40,30,20,0.16)]"
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
                className="absolute left-1/2 top-1/2 w-[70px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 px-1 py-0.5 text-center text-[10px] font-black leading-[1.05] text-[var(--rcu-ink)] shadow-sm"
                style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-75px) rotate(${-angle}deg)` }}
              >
                {shortLabel}
              </div>
            );
          })}
        </div>
        <div className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-[var(--rcu-primary)] shadow-[0_7px_18px_rgba(35,28,20,0.16)]">
          {merchant?.logo_url ? <img src={merchant.logo_url} alt="" className="h-full w-full bg-white object-contain p-1.5" /> : <span className="text-lg font-black text-white">H</span>}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-black text-[color-mix(in_srgb,var(--rcu-ink)_55%,transparent)]">{prizes.length} lots en jeu · 1 lancer par visite</p>
    </div>
  );
}

function RaffleVisual({ program, play, loyalty }: { program: RcuProgram; play: RcuGameRecord | null; loyalty: RcuLoyaltySnapshot | null }) {
  const raffleMonth = play?.result.raffleMonth ?? new Date().toISOString().slice(0, 7);
  const ticketCount = loyalty?.raffleTickets.filter((ticket) => ticket.month === raffleMonth).length ?? play?.result.raffleTicketsTotal ?? 0;
  const ticketNumber = play?.result.raffleTicket?.match(/(\d+)$/)?.[1];

  return (
    <div>
      <div className="flex overflow-hidden rounded-[16px] border border-[var(--rcu-border)] bg-white">
        <div className="min-w-0 flex-1 px-3 py-4 text-center">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--rcu-ink)_45%,transparent)]">Tombola mensuelle</div>
          <div className="mt-1.5 text-base font-black leading-tight text-[var(--rcu-ink)]">{program.game_config.rafflePrize ?? "Le lot du mois"}</div>
          <div className="mt-2.5 text-[10px] font-black tracking-[0.14em] text-[var(--rcu-primary)]">1 SCAN = 1 TICKET</div>
        </div>
        <div className="relative flex w-[78px] shrink-0 flex-col items-center justify-center border-l-2 border-dashed border-[var(--rcu-border)] bg-[var(--rcu-soft)] text-[var(--rcu-ink)]">
          <b className="text-lg font-black">{ticketNumber ? `#${ticketNumber}` : "#—"}</b>
          <small className="text-[8px] font-black uppercase tracking-wider">Ticket</small>
        </div>
      </div>
      <div className="mt-3 text-center text-xs font-black text-[var(--rcu-primary)]">{ticketCount} ticket{ticketCount > 1 ? "s" : ""} déjà en jeu ce mois-ci</div>
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
              className={`flex aspect-square min-w-0 items-center justify-center rounded-[15px] border-2 text-sm font-black transition ${filled ? "scale-[1.04] border-[var(--rcu-primary)] bg-white text-[var(--rcu-primary)] shadow-[0_7px_18px_rgba(35,28,20,0.08)]" : next ? "border-[var(--rcu-accent)] bg-white text-[var(--rcu-accent)]" : reward ? "border-[var(--rcu-primary)] bg-white/70 text-[var(--rcu-accent)]" : "border-dashed border-[var(--rcu-border)] text-[color-mix(in_srgb,var(--rcu-ink)_30%,transparent)]"}`}
            >
              {filled ? "★" : reward ? "★" : index + 1}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] font-black text-[color-mix(in_srgb,var(--rcu-ink)_58%,transparent)]">{program.game_config.stampReward ?? "Votre cadeau fidélité"} à la {target}e visite</p>
    </div>
  );
}

function HansVisual({ play }: { play: RcuGameRecord | null }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-1 py-1 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-white bg-[var(--rcu-soft)] shadow-[0_10px_28px_rgba(35,28,20,0.10)]">
        <HansAvatar size={58} />
      </div>
      <div className="text-sm font-black text-[var(--rcu-ink)]">Hans personnalise votre fidélité</div>
      <div className="min-w-[210px] rounded-full bg-[var(--rcu-primary)] px-4 py-2 text-xs font-black text-[var(--rcu-on-primary)]">
        {play?.result.hansRecommendation ?? "Calcul du bonus le plus pertinent"}
      </div>
      <div className="text-[10px] font-bold text-[color-mix(in_srgb,var(--rcu-ink)_45%,transparent)]">L’analyse s’affine à chaque visite validée.</div>
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
  return <div className="rounded-[14px] border border-[var(--rcu-border)] bg-white px-3 py-2.5 text-xs font-black text-[var(--rcu-ink)]">{children}</div>;
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
  const brand = getRcuConsumerBrand(merchant, brandSettings);
  const style: BrandStyle = {
    "--rcu-primary": brand.primary,
    "--rcu-secondary": brand.secondary,
    "--rcu-accent": brand.accent,
    "--rcu-ink": brand.ink,
    "--rcu-surface": brand.surface,
    "--rcu-soft": brand.soft,
    "--rcu-border": brand.border,
    "--rcu-on-primary": brand.onPrimary,
    "--rcu-font": brand.fontStack,
    "--rcu-title-font": brand.titleFontStack,
    fontFamily: "var(--rcu-font)",
    colorScheme: "light"
  };
  const fieldClass = "w-full rounded-[14px] border border-[var(--rcu-border)] bg-white px-3.5 py-3 text-sm font-semibold text-[var(--rcu-ink)] outline-none transition placeholder:text-[color-mix(in_srgb,var(--rcu-ink)_35%,transparent)] focus:border-[var(--rcu-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--rcu-primary)_10%,transparent)]";
  const status = getProgramStatus({ program, play, progressPlay, loyalty });

  return (
    <main
      className="relative min-h-screen overflow-hidden px-3 py-5 text-[var(--rcu-ink)] sm:px-5 sm:py-10"
      style={{
        ...style,
        background: "radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--rcu-primary) 10%, transparent), transparent 34%), radial-gradient(circle at 96% 12%, color-mix(in srgb, var(--rcu-accent) 9%, transparent), transparent 30%), var(--rcu-surface)"
      }}
    >
      <div className="pointer-events-none absolute -left-20 top-52 h-52 w-52 rounded-full bg-[color-mix(in_srgb,var(--rcu-primary)_7%,transparent)] blur-2xl" />
      <div className="pointer-events-none absolute -right-20 top-10 h-60 w-60 rounded-full bg-[color-mix(in_srgb,var(--rcu-accent)_7%,transparent)] blur-2xl" />

      <article className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-[32px] border border-[var(--rcu-border)] bg-white px-5 py-5 shadow-[0_30px_80px_-34px_rgba(45,34,24,0.28)] sm:px-7 sm:py-7">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[var(--rcu-primary)]" />
        <header className="mb-7 flex items-center justify-between gap-3 pt-1">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo merchant={merchant} compact />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-extrabold tracking-tight text-[var(--rcu-ink)]" style={{ fontFamily: "var(--rcu-title-font)" }}>{merchant?.business_name ?? "Votre boutique"}</div>
              <div className="mt-1 truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--rcu-primary)]">{merchant?.city ?? "Programme fidélité"}</div>
            </div>
          </div>
          {walletHref ? (
            <Link href={walletHref} className="shrink-0 rounded-full border border-[var(--rcu-border)] bg-[var(--rcu-soft)] px-3 py-1.5 text-[11px] font-black text-[var(--rcu-primary)] transition hover:-translate-y-0.5">
              {status}
            </Link>
          ) : (
            <div className="shrink-0 rounded-full border border-[var(--rcu-border)] bg-[var(--rcu-soft)] px-3 py-1.5 text-[11px] font-black text-[var(--rcu-primary)]">{status}</div>
          )}
        </header>

        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--rcu-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--rcu-primary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--rcu-accent)]" />
          {type.label}
        </div>
        <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.025em] text-[var(--rcu-ink)]" style={{ fontFamily: "var(--rcu-title-font)" }}>
          <HighlightedTitle title={program.title} type={program.form_type} />
        </h1>
        <p className="mt-3 text-[14px] font-medium leading-[1.65] text-[color-mix(in_srgb,var(--rcu-ink)_66%,transparent)]">{program.incentive_text}</p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {["Je m’identifie", "Ma visite est validée", "Je profite de mon avantage"].map((step, index) => (
            <div key={step} className={`min-w-0 rounded-[15px] border p-2.5 ${alreadyPlayedToday || index === 0 ? "border-[var(--rcu-border)] bg-[var(--rcu-soft)]" : "border-[var(--rcu-border)] bg-white"}`}>
              <span className={`flex h-[24px] w-[24px] items-center justify-center rounded-full text-[10px] font-black ${alreadyPlayedToday || index === 0 ? "bg-[var(--rcu-primary)] text-[var(--rcu-on-primary)]" : "bg-[var(--rcu-surface)] text-[var(--rcu-primary)]"}`}>{alreadyPlayedToday ? "✓" : index + 1}</span>
              <span className="mt-2 block text-[9.5px] font-bold leading-[1.3] text-[var(--rcu-ink)]">{step}</span>
            </div>
          ))}
        </div>

        <section className="mt-5 rounded-[24px] border border-[var(--rcu-border)] bg-[var(--rcu-soft)] p-4.5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--rcu-primary)]">Votre avantage</span>
            <span className="rounded-full border border-[var(--rcu-border)] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--rcu-ink)_55%,transparent)]">Fidélité</span>
          </div>
          <GameVisual program={program} play={play} progressPlay={progressPlay} loyalty={loyalty} merchant={merchant} />
        </section>

        {errorMessage ? <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-bold leading-5 text-red-700">{errorMessage}</div> : null}

        {alreadyPlayedToday && play ? (
          <section className="mt-5 rounded-[24px] border border-[var(--rcu-border)] bg-white p-5 text-center shadow-[0_12px_34px_rgba(40,30,20,0.06)]">
            <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--rcu-primary)]">Participation enregistrée</div>
            <h2 className="mt-2 text-[24px] font-bold leading-tight text-[var(--rcu-ink)]" style={{ fontFamily: "var(--rcu-title-font)" }}>{play.result.message}</h2>
            <div className="mt-4 grid gap-2">
              {play.result.unlockedRewards?.length ? <ResultDetail>🎁 Débloqué : {play.result.unlockedRewards.map((reward) => reward.label).join(", ")}</ResultDetail> : null}
              {play.result.wheelPrize ? <ResultDetail>Résultat : {play.result.wheelPrize}</ResultDetail> : null}
              {play.result.rewardUnlocked ? <ResultDetail>🎁 {play.result.stampReward}</ResultDetail> : null}
            </div>
            {walletHref ? <Link href={walletHref} className="mt-5 inline-flex rounded-[14px] bg-[var(--rcu-primary)] px-5 py-3 text-xs font-black uppercase tracking-wide text-[var(--rcu-on-primary)] shadow-[0_10px_24px_rgba(40,30,20,0.12)]">Voir mon portefeuille</Link> : null}
            <p className="mx-auto mt-4 max-w-xs text-[10.5px] font-semibold leading-4 text-[color-mix(in_srgb,var(--rcu-ink)_45%,transparent)]">Cette participation ne peut pas être rejouée aujourd’hui. Revenez lors de votre prochaine visite.</p>
          </section>
        ) : (
          <form action={submitAction} className="mt-5 rounded-[24px] border border-[var(--rcu-border)] bg-[var(--rcu-surface)] p-4 sm:p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--rcu-primary)]">Mes informations</div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--rcu-ink)]" style={{ fontFamily: "var(--rcu-title-font)" }}>Créer ou retrouver ma fidélité</h2>

            {wallet ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-[13px] bg-[var(--rcu-primary)] px-3 py-2.5 text-xs font-bold text-[var(--rcu-on-primary)]">
                <span className="min-w-0">Bonjour {wallet.first_name}, votre portefeuille est reconnu.</span>
                <Link href={newCustomerHref} className="shrink-0 rounded-full bg-white/15 px-2.5 py-1.5 text-[10px] font-black">Ce n’est pas moi</Link>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--rcu-ink)_58%,transparent)]">Prénom<input name="first_name" required defaultValue={wallet?.first_name ?? ""} placeholder="Prénom" className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--rcu-ink)_58%,transparent)]">Nom<input name="last_name" defaultValue={wallet?.last_name ?? ""} placeholder="Nom" className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--rcu-ink)_58%,transparent)]">Téléphone<input name="phone" required inputMode="tel" defaultValue={wallet?.phone ?? ""} placeholder="Téléphone" className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--rcu-ink)_58%,transparent)]">Adresse e-mail<input name="email" required type="email" inputMode="email" defaultValue={wallet?.email ?? ""} placeholder="E-mail" className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--rcu-ink)_58%,transparent)]">Date de naissance<input name="birthday" required type="date" max={new Date().toISOString().slice(0, 10)} className={`${fieldClass} mt-1.5`} /></label>
              <label className="min-w-0 text-[9px] font-black uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--rcu-ink)_58%,transparent)]">Préférence <span className="normal-case tracking-normal">(optionnelle)</span><input name="favorite_products" placeholder="Produit préféré" className={`${fieldClass} mt-1.5`} /></label>
            </div>

            {program.game_config.visitValidationEnabled !== false ? (
              <div className="mt-4 rounded-[17px] border-[1.5px] border-dashed border-[var(--rcu-border)] bg-white p-3.5">
                <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-[var(--rcu-primary)]">
                  Validation par le commerçant
                  <input type="password" name="visit_code" required minLength={2} maxLength={4} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="mt-2.5 w-full rounded-[11px] border border-[var(--rcu-border)] bg-[var(--rcu-soft)] px-4 py-2.5 text-center font-mono text-xl font-black uppercase tracking-[0.55em] text-[var(--rcu-primary)] outline-none focus:border-[var(--rcu-primary)]" placeholder="••••" />
                </label>
                <p className="mt-2 text-center text-[10px] font-semibold leading-4 text-[color-mix(in_srgb,var(--rcu-ink)_52%,transparent)]">Présentez votre téléphone au commerçant pour valider votre visite.</p>
              </div>
            ) : null}

            {program.form_type === "points" && program.target_url ? (
              <div className="mt-3 rounded-[14px] border border-[var(--rcu-border)] bg-white p-3.5">
                <a href={program.target_url} target="_blank" rel="noreferrer" className="text-xs font-black text-[var(--rcu-primary)] underline underline-offset-4">Laisser un avis (+{program.game_config.reviewBonus ?? 100} points)</a>
                <label className="mt-3 flex items-start gap-2.5 text-[10.5px] font-semibold leading-4 text-[color-mix(in_srgb,var(--rcu-ink)_60%,transparent)]"><input name="review_confirmed" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--rcu-primary)]" /><span>Le commerçant confirme que l’avis a bien été publié.</span></label>
              </div>
            ) : null}

            <label className="mt-4 flex items-start gap-2.5 text-[10.5px] font-medium leading-[1.5] text-[color-mix(in_srgb,var(--rcu-ink)_55%,transparent)]">
              <input name="consent_all" type="checkbox" required className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--rcu-primary)]" />
              <span>J’accepte que {merchant?.business_name ?? "la boutique"} utilise mes informations pour gérer ma participation et mon programme de fidélité, et m’adresse ses offres par e-mail et par SMS. Je pourrai retirer mon accord à tout moment.</span>
            </label>

            <div className="mt-5"><RcuSubmitButton label={program.cta_label ?? type.defaultCtaLabel} /></div>
          </form>
        )}

        <footer className="mt-6 border-t border-[var(--rcu-border)] pt-5 text-center text-[10px] font-bold tracking-wide text-[color-mix(in_srgb,var(--rcu-ink)_44%,transparent)]">
          {merchant?.business_name ?? "Votre boutique"}{merchant?.city ? ` · ${merchant.city}` : ""}
        </footer>
      </article>
    </main>
  );
}
