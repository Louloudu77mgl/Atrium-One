import Link from "next/link";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { mapUserFacingError } from "@/lib/user-feedback";

export const dynamic = "force-dynamic";

export default async function InstagramIntegrationPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const connection = merchant ? await getInstagramConnection(merchant) : null;
  const configured = hasInstagramOAuthConfig();
  const connected = connection?.status === "connected";
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <Sidebar active="integrations" merchant={merchant} counters={counters} />
      <div className="min-h-screen md:ml-60">
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className="px-4 py-6 pb-24 md:px-7 md:py-7">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex items-center justify-between gap-4">
              <Link href="/integrations" className="text-sm font-semibold text-[#5B2A9E] hover:underline">
                ← Retour aux intégrations
              </Link>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? "bg-[#EAF7EE] text-[#25834A]" : "bg-[#FBF0E1] text-[#A65C16]"}`}>
                {connected ? "Compte connecté" : "Connexion requise"}
              </span>
            </div>

            <section className="overflow-hidden rounded-[30px] border border-[#E9D5FF] bg-white shadow-[0_18px_55px_rgba(76,29,149,0.10)]">
              <div className="bg-[linear-gradient(135deg,#3B1B67,#7C4DCB)] px-6 py-8 text-white md:px-9">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E9D5FF]">Connexion Meta</p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] md:text-4xl">Connectez votre compte Instagram</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F3E8FF]">
                  Autorisez AtriumOne à publier sur le compte professionnel de votre établissement. Aucun mot de passe Instagram n’est enregistré dans AtriumOne.
                </p>
              </div>

              <div className="space-y-6 p-6 md:p-9">
                {params?.saved === "instagram" && connected ? (
                  <div className="rounded-2xl border border-[#BFE4CA] bg-[#EAF7EE] p-4 text-sm font-semibold text-[#237A44]">
                    Instagram est connecté à AtriumOne{connection?.instagram_username ? ` avec @${connection.instagram_username}` : ""}.
                  </div>
                ) : null}

                {params?.error ? (
                  <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">
                    {mapUserFacingError(params.error)}
                  </div>
                ) : null}

                {!configured ? (
                  <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4 text-sm leading-6 text-[#9A3412]">
                    <strong>La connexion Meta n’est pas encore configurée sur ce serveur.</strong>
                    <p className="mt-1">
                      L’administrateur AtriumOne doit configurer la connexion Instagram, puis redéployer l’application.
                    </p>
                  </div>
                ) : null}

                <div>
                  <h2 className="text-xl font-black text-[#211432]">Avant de commencer</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Requirement number="1" title="Compte professionnel" text="Votre compte Instagram doit être Professionnel ou Créateur." />
                    <Requirement number="2" title="Page Facebook liée" text="Le compte doit être relié à une Page Facebook." />
                    <Requirement number="3" title="Accès administrateur" text="Connectez-vous avec le profil Meta qui administre cette Page." />
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FBFAFF] p-5">
                  <h2 className="text-lg font-black text-[#211432]">Ce qui va se passer</h2>
                  <ol className="mt-3 space-y-3 text-sm leading-6 text-[#625873]">
                    <li><strong className="text-[#4C1D95]">1.</strong> Meta s’ouvre dans une page sécurisée.</li>
                    <li><strong className="text-[#4C1D95]">2.</strong> Vous choisissez la Page et le compte Instagram de votre établissement.</li>
                    <li><strong className="text-[#4C1D95]">3.</strong> Vous autorisez la publication de contenus.</li>
                    <li><strong className="text-[#4C1D95]">4.</strong> Vous revenez automatiquement dans AtriumOne avec le compte connecté.</li>
                  </ol>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {configured ? (
                    <a href="/api/instagram/connect" className="inline-flex items-center justify-center rounded-full bg-[#4C1D95] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(76,29,149,0.24)] transition hover:bg-[#6D28D9]">
                      {connected ? "Reconnecter un compte Instagram" : "Continuer avec Meta"}
                    </a>
                  ) : (
                    <span className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-[#D8D2E2] px-6 py-3 text-sm font-bold text-white">
                      Connexion Meta indisponible
                    </span>
                  )}
                  {connected ? (
                    <Link href="/social" className="inline-flex items-center justify-center rounded-full border border-[#DDD6FE] bg-white px-6 py-3 text-sm font-bold text-[#4C1D95] transition hover:bg-[#F5F0FF]">
                      Accéder aux publications
                    </Link>
                  ) : null}
                </div>

                {connection?.last_error ? (
                  <p className="rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
                    Dernière erreur : {mapUserFacingError(connection.last_error)}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Requirement({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#ECE7F3] p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3E8FF] text-sm font-black text-[#5B2A9E]">{number}</span>
      <h3 className="mt-3 text-sm font-black text-[#211432]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[#6B617F]">{text}</p>
    </div>
  );
}
