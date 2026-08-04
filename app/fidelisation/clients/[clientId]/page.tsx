import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { badgeStyles, buttonStyles, appShellStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import { getAppNotifications } from "@/lib/notifications";
import { getRcuTypeDefinition } from "@/lib/rcu";
import { buildRcuLoyaltySnapshot } from "@/lib/rcu-loyalty";
import { redeemRcuRewardAction } from "@/lib/rcu-loyalty-server";
import { getStoredRcuCustomerDetail, listStoredRcuForms } from "@/lib/rcu-store";
import { getReviewCountersFromReviews } from "@/lib/review-counters";

export const dynamic = "force-dynamic";

function getResultLabel(play: NonNullable<Awaited<ReturnType<typeof getStoredRcuCustomerDetail>>>["plays"][number]) {
  const result = play.result;
  if (play.program_type === "points") return `${result.pointsTotal ?? 0} points au total`;
  if (play.program_type === "wheel") return result.wheelPrize ?? "Roue jouée";
  if (play.program_type === "raffle") return `Ticket ${result.raffleTicket ?? "validé"}`;
  if (play.program_type === "stamps") return `${result.stampCount ?? 0}/${result.stampTarget ?? 5} visites`;
  return result.hansRecommendation ?? result.message;
}

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  if (!merchant) notFound();
  const [detail, rcuPrograms] = await Promise.all([
    getStoredRcuCustomerDetail(merchant.id, clientId),
    listStoredRcuForms(merchant.id)
  ]);
  if (!detail) notFound();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const loyalty = buildRcuLoyaltySnapshot({ programs: rcuPrograms, plays: detail.plays, redemptions: detail.redemptions, raffleDraws: detail.raffleDraws });
  const programCount = new Set(detail.plays.map((play) => play.program_id)).size;

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="clients" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className="mx-auto max-w-6xl space-y-6">
            <section className={surfaceStyles.hero}>
              <Link href="/fidelisation/clients" className={buttonStyles.tertiary}>← Base clients</Link>
              <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><p className={`${typographyStyles.kicker} mb-2`}>Fiche fidélité unifiée</p><h1 className={typographyStyles.h1}>{detail.customer.first_name} {detail.customer.last_name}</h1><p className={`${typographyStyles.body} mt-2`}>{detail.customer.phone}{detail.customer.email ? ` · ${detail.customer.email}` : ""}</p></div>
                <div className="flex flex-wrap gap-2">{detail.wallet ? <Link href={`/fidelite/${detail.wallet.token}`} target="_blank" className={buttonStyles.secondary}>Voir son portefeuille</Link> : null}<span className={detail.customer.opt_in_sms ? badgeStyles.hans : badgeStyles.neutral}>{detail.customer.opt_in_sms ? "Consentement actif" : "Sans consentement SMS"}</span></div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <article className={surfaceStyles.kpi}><div className={typographyStyles.kicker}>Participations</div><div className="mt-3 text-3xl font-black">{detail.plays.length}</div></article>
              <article className={surfaceStyles.kpi}><div className={typographyStyles.kicker}>Programmes joués</div><div className="mt-3 text-3xl font-black">{programCount}</div></article>
              <article className={surfaceStyles.kpi}><div className={typographyStyles.kicker}>Solde disponible</div><div className="mt-3 text-3xl font-black">{loyalty.pointsBalance}</div></article>
              <article className={surfaceStyles.kpi}><div className={typographyStyles.kicker}>Récompenses disponibles</div><div className="mt-3 text-3xl font-black">{loyalty.availableRewards.length}</div></article>
            </section>

            <section className={surfaceStyles.section}>
              <div><h2 className={typographyStyles.h2}>Récompenses à utiliser</h2><p className={`${typographyStyles.body} mt-1`}>Validez ici la remise physique du cadeau au client.</p></div>
              {loyalty.availableRewards.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{loyalty.availableRewards.map((reward) => <form key={reward.id} action={redeemRcuRewardAction} className={`${surfaceStyles.subtle} flex items-center justify-between gap-4 p-4`}><input type="hidden" name="customer_key" value={clientId} /><input type="hidden" name="reward_id" value={reward.id} /><div><div className="font-black text-[var(--color-text)]">{reward.label}</div><div className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">{reward.pointsCost ? `${reward.pointsCost} points` : "Cadeau débloqué"} · {reward.programTitle}</div></div><button type="submit" className={buttonStyles.primary}>Marquer utilisée</button></form>)}</div> : <div className={`${surfaceStyles.empty} mt-4 px-5 py-6 text-center text-sm text-[var(--color-text-muted)]`}>Aucune récompense disponible actuellement.</div>}
            </section>

            <section className={surfaceStyles.section}>
              <div><h2 className={typographyStyles.h2}>Journal des jeux</h2><p className={`${typographyStyles.body} mt-1`}>Une seule timeline dynamique pour tous les types de RCU.</p></div>
              {detail.plays.length === 0 ? (
                <div className={`${surfaceStyles.empty} mt-5 px-5 py-8 text-center`}><div className={typographyStyles.h3}>Aucun jeu effectué</div><p className={`${typographyStyles.body} mt-2`}>Ce contact est dans la base, mais n’a pas encore validé de visite RCU.</p></div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-[20px] border border-[var(--color-border)]">
                  {detail.plays.map((play) => {
                    const type = getRcuTypeDefinition(play.program_type);
                    return (
                      <article key={play.id} className="grid gap-3 border-t border-[var(--color-border)] px-4 py-4 first:border-t-0 md:grid-cols-[1.1fr_1fr_1.6fr] md:items-center">
                        <div><div className="font-black text-[var(--color-text)]">{play.program_title}</div><div className="mt-1 text-xs text-[var(--color-text-muted)]">{new Date(play.occurred_at).toLocaleString("fr-FR")}</div></div>
                        <div><span className={play.program_type === "smart_hans" || play.program_type === "points" ? badgeStyles.hans : badgeStyles.neutral}>{type.shortLabel}</span></div>
                        <div><div className="text-sm font-bold text-[var(--color-text)]">{getResultLabel(play)}</div><div className="mt-1 text-xs text-[var(--color-text-muted)]">{play.result.message}</div></div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
