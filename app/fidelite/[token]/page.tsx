import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { buildRcuLoyaltySnapshot } from "@/lib/rcu-loyalty";
import {
  getRcuPublicBrand,
  getStoredRcuWalletByToken,
  listStoredRcuForms,
  listStoredRcuGameRecords,
  listStoredRcuRaffleDraws,
  listStoredRcuRewardRedemptions
} from "@/lib/rcu-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon portefeuille fidélité", robots: { index: false, follow: false } };

type WalletStyle = CSSProperties & { "--wallet-primary": string; "--wallet-secondary": string; "--wallet-accent": string; "--wallet-font": string };

export default async function LoyaltyWalletPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const wallet = await getStoredRcuWalletByToken(token);
  if (!wallet) notFound();
  const [brand, programs, plays, redemptions, raffleDraws] = await Promise.all([
    getRcuPublicBrand(wallet.merchant_id),
    listStoredRcuForms(wallet.merchant_id),
    listStoredRcuGameRecords(wallet.merchant_id, { customerKey: wallet.customer_key }),
    listStoredRcuRewardRedemptions(wallet.merchant_id, { customerKey: wallet.customer_key }),
    listStoredRcuRaffleDraws(wallet.merchant_id, { customerKey: wallet.customer_key })
  ]);
  const snapshot = buildRcuLoyaltySnapshot({ programs, plays, redemptions, raffleDraws });
  const hasPointsProgram = programs.some((program) => program.form_type === "points");
  const style: WalletStyle = {
    "--wallet-primary": brand.brandSettings?.primary_color ?? "#4C1D95",
    "--wallet-secondary": brand.brandSettings?.secondary_color ?? "#F3E8FF",
    "--wallet-accent": brand.brandSettings?.accent_color ?? "#A855F7",
    "--wallet-font": brand.brandSettings?.social_font_family ?? "Inter",
    fontFamily: "var(--wallet-font)"
  };

  return (
    <main className="min-h-screen bg-[var(--wallet-secondary)] px-4 py-6 text-slate-950 sm:py-10" style={style}>
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-4 rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">{brand.merchant?.logo_url ? <img src={brand.merchant.logo_url} alt={`Logo ${brand.merchant.business_name}`} className="h-12 w-12 rounded-2xl object-contain" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wallet-primary)] font-black text-white">{brand.merchant?.business_name?.slice(0, 1) ?? "H"}</div>}<div><div className="font-black">{brand.merchant?.business_name ?? "Votre boutique"}</div><div className="text-xs font-semibold text-slate-500">Portefeuille de {wallet.first_name}</div></div></div>
          <div className="rounded-full bg-[var(--wallet-secondary)] px-3 py-1.5 text-xs font-black text-[var(--wallet-primary)]">Fidélité</div>
        </header>

        <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-[var(--wallet-primary)] to-[var(--wallet-accent)] p-6 text-white shadow-2xl sm:p-8">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Solde disponible</div><div className="mt-2 text-6xl font-black">{snapshot.pointsBalance}<span className="ml-2 text-xl text-white/70">pts</span></div>
          {snapshot.temporaryBonus ? <div className="mt-5 rounded-2xl border border-white/20 bg-white/15 px-4 py-3 text-sm font-black">⚡ {snapshot.temporaryBonus}</div> : null}
          <div className="mt-6 flex items-center justify-between text-xs font-bold"><span>{snapshot.nextReward ? `Prochaine récompense : ${snapshot.nextReward.label}` : hasPointsProgram ? "Toutes les récompenses sont accessibles" : "Vos gains et visites sont réunis ici"}</span><span>{hasPointsProgram ? `${snapshot.progressPercent}%` : `${snapshot.totalVisits} visite(s)`}</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${snapshot.progressPercent}%` }} /></div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3"><article className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wider text-slate-500">Visites validées</div><div className="mt-2 text-3xl font-black">{snapshot.totalVisits}</div></article><article className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wider text-slate-500">Points gagnés</div><div className="mt-2 text-3xl font-black">{snapshot.pointsEarned}</div></article><article className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wider text-slate-500">Cadeaux utilisés</div><div className="mt-2 text-3xl font-black">{snapshot.usedRewards.length}</div></article></section>

        <section className="rounded-[30px] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Récompenses disponibles</h2><p className="mt-1 text-sm text-slate-500">Présentez cet écran au personnel pour utiliser un cadeau.</p>{snapshot.availableRewards.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{snapshot.availableRewards.map((reward) => <article key={reward.id} className="rounded-2xl border border-[var(--wallet-accent)]/30 bg-[var(--wallet-secondary)] p-4"><div className="text-lg font-black">🎁 {reward.label}</div><div className="mt-1 text-xs font-bold text-[var(--wallet-primary)]">{reward.pointsCost ? `${reward.pointsCost} points` : "Déjà débloquée"} · {reward.programTitle}</div></article>)}</div> : <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">Encore quelques visites pour débloquer votre prochain cadeau.</div>}</section>

        {snapshot.hansOffers.length || snapshot.temporaryBonus ? <section className="rounded-[30px] border border-[var(--wallet-accent)]/20 bg-white p-5 shadow-sm sm:p-6"><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--wallet-primary)]">Offres personnalisées par Hans</div><div className="mt-3 space-y-2">{snapshot.hansOffers.map((offer) => <div key={offer} className="rounded-2xl bg-[var(--wallet-secondary)] p-4 text-sm font-semibold leading-6">✨ {offer}</div>)}</div></section> : null}

        <section className="rounded-[30px] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Historique des points</h2>{snapshot.pointsHistory.length ? <div className="mt-4 divide-y divide-slate-100">{snapshot.pointsHistory.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-4 py-3"><div><div className="text-sm font-bold">{entry.reason}</div><div className="mt-1 text-xs text-slate-500">{new Date(entry.occurredAt).toLocaleDateString("fr-FR")}</div></div><div className="shrink-0 text-lg font-black text-emerald-600">+{entry.points}</div></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Aucun point gagné pour le moment.</p>}</section>

        {snapshot.raffleTickets.length ? <section className="rounded-[30px] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Mes tickets de tombola</h2><div className="mt-4 divide-y divide-slate-100">{snapshot.raffleTickets.map((ticket) => <div key={ticket.id} className="flex items-center justify-between gap-4 py-3"><div><div className="text-sm font-bold">{ticket.programTitle}</div><div className="mt-1 text-xs text-slate-500">Tirage {ticket.month}</div></div><div className="font-mono text-xs font-black text-[var(--wallet-primary)]">{ticket.ticket}</div></div>)}</div></section> : null}

        <section className="rounded-[30px] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Récompenses utilisées</h2>{snapshot.usedRewards.length ? <div className="mt-4 divide-y divide-slate-100">{snapshot.usedRewards.map((reward) => <div key={reward.id} className="flex items-center justify-between gap-4 py-3"><div><div className="text-sm font-bold">{reward.reward_label}</div><div className="mt-1 text-xs text-slate-500">{new Date(reward.occurred_at).toLocaleDateString("fr-FR")}</div></div><div className="text-sm font-black text-slate-500">{reward.points_cost ? `−${reward.points_cost} pts` : "Utilisée"}</div></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Aucune récompense utilisée.</p>}</section>
        <footer className="py-4 text-center text-xs font-semibold text-slate-500">Portefeuille sécurisé propulsé par Hans</footer>
      </div>
    </main>
  );
}
