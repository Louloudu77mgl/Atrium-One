import Link from "next/link";
import { Header } from "@/components/Header";
import { GmailConnectionActions } from "@/components/GmailConnectionActions";
import { IntegrationDisconnectButton } from "@/components/IntegrationDisconnectButton";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { getGmailConnection, isGmailConnectionReady } from "@/lib/gmail-connections";
import { hasGmailOAuthConfig } from "@/lib/gmail-oauth";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { mapUserFacingError } from "@/lib/user-feedback";
import { appShellStyles } from "@/lib/design-system";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string; imported?: string; sync_error?: string }>;
}) {
  const params = await searchParams;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const [instagramConnection, gmailConnection] = merchant
    ? await Promise.all([getInstagramConnection(merchant), getGmailConnection(merchant)])
    : [null, null];
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const instagramConfigured = hasInstagramOAuthConfig();
  const gmailConfigured = hasGmailOAuthConfig();
  const gmailConnected = isGmailConnectionReady(gmailConnection);
  const instagramReady = instagramConnection?.status === "connected" || instagramConnection?.status === "expiring";
  const instagramReconnectRequired = instagramConnection?.status === "expired" || instagramConnection?.status === "revoked" || instagramConnection?.status === "error";
  const googleConnected = googleConnection?.status === "connected";
  const googleLocationConnected = Boolean(googleConnection?.google_location_id);

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="integrations" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className={appShellStyles.width}>
            <section className="rounded-[28px] border border-[#E9D5FF] bg-white p-6 shadow-[0_14px_44px_rgba(76,29,149,0.08)]">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Intégrations</p>
              <h1 className="text-3xl font-black tracking-[-0.05em] text-[#211432]">Quels comptes sont connectés&nbsp;?</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B617F]">
                Connectez vos comptes pour importer les avis Google, publier sur Instagram et envoyer vos campagnes depuis votre propre Gmail.
              </p>
            </section>

            {params?.saved === "instagram" ? (
              <div className="rounded-lg border border-[#BFE4CA] bg-[#EAF7EE] px-3.5 py-2.5 text-sm text-[#237A44]">Compte Instagram connecté.</div>
            ) : params?.saved === "gmail" ? (
              <div className="rounded-lg border border-[#BFE4CA] bg-[#EAF7EE] px-3.5 py-2.5 text-sm text-[#237A44]">Compte Gmail connecté.</div>
            ) : params?.saved ? (
              <div className="rounded-lg border border-[#DDD6FE] bg-[#F3E8FF] px-3.5 py-2.5 text-sm text-[#7C3AED]">Fiche Google Business connectée.{params.imported ? ` ${params.imported} avis Google synchronisé${params.imported === "1" ? "" : "s"}.` : ""}</div>
            ) : null}
            {params?.sync_error ? (
              <div className="rounded-lg border border-[#FED7AA] bg-[#FFF7ED] px-3.5 py-2.5 text-sm text-[#C2410C]">
                Google est connecté, mais l’import des avis n’a pas abouti : {mapUserFacingError(params.sync_error)}
              </div>
            ) : null}
            {params?.error ? <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#DC2626]">{mapUserFacingError(params.error)}</div> : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Google Business</p>
                <h2 className="text-xl font-black text-[#211432]">
                  {googleConnected ? googleLocationConnected ? "Connecté à Google Fiche Business" : "Compte Google connecté · fiche à finaliser" : "Google non connecté"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6B617F]">
                  {googleConnected
                    ? `${googleConnection.google_account_email ?? "Compte Google"}${googleConnection.google_location_name ? ` · ${googleConnection.google_location_name}` : " · choisissez la fiche pour importer les avis"}`
                    : "Connectez votre fiche Google pour importer vos avis."}
                </p>
                {googleConnection?.last_sync_at ? (
                  <p className="mt-4 text-xs font-semibold text-[#8B7AA8]">
                    Dernière récupération : {new Date(googleConnection.last_sync_at).toLocaleString("fr-FR")}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href="/api/google/connect" className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
                    {googleConnection?.status === "connected" ? "Reconnecter Google" : "Connecter Google"}
                  </a>
                  {googleConnection?.status === "connected" && !googleConnection.google_location_id ? (
                    <Link href="/settings/google-business/select-location" className="inline-flex items-center justify-center rounded-lg bg-[#FFF7ED] px-4 py-2.5 text-sm font-semibold text-[#C2410C] transition hover:bg-[#FFEDD5]">
                      Finaliser la fiche
                    </Link>
                  ) : null}
                  {googleConnected ? (
                    <form action="/api/google/sync" method="post">
                      <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-[#F3E8FF] px-4 py-2.5 text-sm font-semibold text-[#4C1D95] transition hover:bg-[#E9D5FF]">
                        {googleLocationConnected ? "Actualiser maintenant (optionnel)" : "Finaliser la fiche"}
                      </button>
                    </form>
                  ) : null}
                  {googleConnected ? <IntegrationDisconnectButton endpoint="/api/google/disconnect" label="Google Fiche Business" /> : null}
                </div>
              </section>

              <section className="rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Instagram</p>
                <h2 className="text-xl font-black text-[#211432]">
                  {getInstagramConnectionTitle(instagramConnection?.status)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6B617F]">
                  {instagramReady
                    ? `Compte connecté : ${instagramConnection.instagram_username ?? "Compte Instagram"}`
                    : instagramReconnectRequired
                      ? "Reconnectez Instagram pour reprendre les publications et les automatisations."
                      : "Connectez le compte Instagram professionnel de cet établissement pour publier directement depuis AtriumOne."}
                </p>
                {instagramConnection?.last_checked_at ? <p className="mt-4 text-xs font-semibold text-[#8B7AA8]">Dernière vérification : {new Date(instagramConnection.last_checked_at).toLocaleString("fr-FR")}</p> : null}
                {!instagramConfigured ? (
                  <div className="mt-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">
                    La connexion Instagram est temporairement indisponible.
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={instagramReady ? "/social#instagram-connection" : "/social?connect=instagram"} className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
                    {instagramReconnectRequired ? "Reconnecter Instagram" : instagramReady ? "Gérer la connexion Instagram" : "Configurer Instagram"}
                  </Link>
                  <Link href="/social" className="inline-flex items-center justify-center rounded-lg bg-[#F3E8FF] px-4 py-2.5 text-sm font-semibold text-[#4C1D95] transition hover:bg-[#E9D5FF]">
                    Ouvrir Instagram
                  </Link>
                  {instagramConnection ? <IntegrationDisconnectButton endpoint="/api/instagram/disconnect" label="Instagram" /> : null}
                </div>
              </section>

              <section className="rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)] lg:col-span-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Gmail</p>
                <h2 className="text-xl font-black text-[#211432]">{gmailConnected ? "Gmail connecté" : "Gmail non connecté"}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6B617F]">
                  {gmailConnected
                    ? `Les campagnes e-mail partent directement depuis ${gmailConnection?.gmail_address}.`
                    : "Connectez l’adresse Gmail du commerce. AtriumOne pourra uniquement envoyer des e-mails, jamais lire la boîte de réception."}
                </p>
                {!gmailConfigured ? <div className="mt-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">La connexion Gmail est temporairement indisponible.</div> : null}
                {gmailConnection?.last_error ? <div className="mt-4 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4 text-sm text-[#9A3412]">{gmailConnection.last_error}</div> : null}
                <div className="mt-4"><GmailConnectionActions connected={gmailConnected} /></div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function getInstagramConnectionTitle(status?: string) {
  if (status === "connected") return "Instagram connecté";
  if (status === "expiring") return "Connexion Instagram à renouveler";
  if (status === "expired") return "Connexion Instagram expirée";
  if (status === "revoked") return "Reconnexion Instagram nécessaire";
  if (status === "error") return "Connexion Instagram à vérifier";
  return "Instagram non connecté";
}
