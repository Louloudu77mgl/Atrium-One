import Link from "next/link";
import { Header } from "@/components/Header";
import { GmailConnectionActions } from "@/components/GmailConnectionActions";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { getGmailConnection, isGmailConnectionReady } from "@/lib/gmail-connections";
import { hasGmailOAuthConfig } from "@/lib/gmail-oauth";
import { getGoogleDiagnosticState } from "@/lib/google-diagnostics";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { mapUserFacingError } from "@/lib/user-feedback";

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
  const googleDiagnostic = await getGoogleDiagnosticState(googleConnection);
  const instagramConfigured = hasInstagramOAuthConfig();
  const gmailConfigured = hasGmailOAuthConfig();
  const gmailConnected = isGmailConnectionReady(gmailConnection);
  const googleConnected = googleConnection?.status === "connected";
  const googleLocationConnected = Boolean(googleConnection?.google_location_id);
  const googleReviewsApiDisabled = Boolean(
    params?.sync_error && (
      params.sync_error.toLowerCase().includes("mybusiness.googleapis.com") ||
      params.sync_error.toLowerCase().includes("service_disabled") ||
      params.sync_error.toLowerCase().includes("google my business api has not been used")
    )
  );

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <Sidebar active="integrations" merchant={merchant} counters={counters} />
      <div className="min-h-screen md:ml-60">
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className="px-4 py-6 pb-24 md:px-7 md:py-7">
          <div className="mx-auto max-w-5xl space-y-6">
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
                {googleReviewsApiDisabled ? (
                  <a
                    href="https://console.developers.google.com/apis/api/mybusiness.googleapis.com/overview?project=650116804104"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 font-bold underline"
                  >
                    Activer l’API des avis
                  </a>
                ) : null}
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
                <div className="mt-4 space-y-2 rounded-2xl bg-[#FBFAFF] p-4 text-sm text-[#6B617F]">
                  <div>OAuth configuré : <strong className="text-[#211432]">{googleDiagnostic.oauthConfigured ? "oui" : "non"}</strong></div>
                  <div>Token disponible : <strong className="text-[#211432]">{googleDiagnostic.tokenAvailable ? "oui" : "non"}</strong></div>
                  <div>Fiche connectée : <strong className="text-[#211432]">{googleDiagnostic.locationConnected ? "oui" : "non"}</strong></div>
                  <div>Synchronisation des avis : <strong className="text-[#211432]">{googleLocationConnected ? "automatique" : "en attente de la fiche"}</strong></div>
                  {googleConnection?.last_sync_at ? <div>Dernière récupération : <strong className="text-[#211432]">{new Date(googleConnection.last_sync_at).toLocaleString("fr-FR")}</strong></div> : null}
                </div>
                {!googleConnection ? (
                  <div className="mt-4 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4 text-sm leading-6 text-[#9A3412]">
                    Si Google affiche une page 403, ajoutez votre compte dans les test users Google Cloud ou passez l’audience OAuth en externe.
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href="/api/google/connect" className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
                    {googleConnection?.status === "connected" ? "Reconnecter Google" : "Connecter Google"}
                  </a>
                  <Link href="/integrations/google-diagnostic" className="inline-flex items-center justify-center rounded-lg bg-[#F3E8FF] px-4 py-2.5 text-sm font-semibold text-[#4C1D95] transition hover:bg-[#E9D5FF]">
                    Diagnostic Google
                  </Link>
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
                </div>
              </section>

              <section className="rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Instagram</p>
                <h2 className="text-xl font-black text-[#211432]">
                  {instagramConnection?.status === "connected" ? "Instagram connecté" : "Instagram non connecté"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6B617F]">
                  {instagramConnection?.status === "connected"
                    ? `Compte connecté : ${instagramConnection.instagram_username ?? "Compte Instagram"}`
                    : "Connectez le compte Instagram professionnel de cet établissement pour publier directement depuis AtriumOne."}
                </p>
                {!instagramConfigured ? (
                  <div className="mt-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">
                    La connexion Instagram est temporairement indisponible.
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={instagramConnection?.status === "connected" ? "/social#instagram-connection" : "/social?connect=instagram"} className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
                    {instagramConnection?.status === "connected" ? "Gérer la connexion Instagram" : "Configurer Instagram"}
                  </Link>
                  <Link href="/social" className="inline-flex items-center justify-center rounded-lg bg-[#F3E8FF] px-4 py-2.5 text-sm font-semibold text-[#4C1D95] transition hover:bg-[#E9D5FF]">
                    Ouvrir Instagram
                  </Link>
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
