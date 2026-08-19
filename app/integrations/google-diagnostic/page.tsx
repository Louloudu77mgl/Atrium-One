import Link from "next/link";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { getGoogleDiagnosticState } from "@/lib/google-diagnostics";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";

export const dynamic = "force-dynamic";

export default async function GoogleDiagnosticPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const diagnostic = await getGoogleDiagnosticState(googleConnection, { liveCheck: true });

  const rows = [
    { label: "Google OAuth configuré", value: diagnostic.oauthConfigured ? "Oui" : "Non" },
    { label: "URI de retour configurée", value: diagnostic.redirectUri ?? "Manquante" },
    { label: "Client OAuth réellement chargé", value: diagnostic.clientId ?? "Manquant" },
    {
      label: "Secret réellement chargé",
      value: diagnostic.clientSecretSuffix
        ? `se termine par …${diagnostic.clientSecretSuffix} · ${diagnostic.clientSecretLength} caractères${diagnostic.clientSecretHasWhitespace ? " · contient un espace ou retour à la ligne" : ""}`
        : "Manquant"
    },
    { label: "Token disponible", value: diagnostic.tokenAvailable ? "Oui" : "Non" },
    { label: "Fiche Google connectée", value: diagnostic.locationConnected ? "Oui" : "Non" },
    { label: "Nombre d’établissements récupérés", value: diagnostic.locationsCount === null ? "Non testé" : String(diagnostic.locationsCount) },
    { label: "Nombre d’avis récupérés", value: diagnostic.reviewsCount === null ? "Non testé" : String(diagnostic.reviewsCount) },
    { label: "Dernière synchronisation", value: diagnostic.latestSync ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(diagnostic.latestSync)) : "Aucune" },
    { label: "Dernière erreur API", value: diagnostic.latestError ?? "Aucune" }
  ];

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <Sidebar active="integrations" merchant={merchant} counters={counters} />
      <div className="min-h-screen md:ml-60">
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className="px-4 py-6 pb-24 md:px-7 md:py-7">
          <div className="mx-auto max-w-4xl space-y-6">
            <section className="rounded-[28px] border border-[#E9D5FF] bg-white p-6 shadow-[0_14px_44px_rgba(76,29,149,0.08)]">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Diagnostic Google</p>
              <h1 className="text-3xl font-black tracking-[-0.05em] text-[#211432]">Vérifier que Google fonctionne vraiment</h1>
              <p className="mt-2 text-sm leading-6 text-[#6B617F]">
                Les secrets et tokens restent côté serveur. Cette page affiche uniquement l’état de santé de l’intégration.
              </p>
            </section>

            <section className="rounded-[22px] border border-[#FED7AA] bg-[#FFF7ED] p-5 shadow-[0_10px_30px_rgba(194,65,12,0.06)]">
              <p className="text-sm font-black text-[#9A3412]">Google affiche 403 avant de revenir sur AtriumOne&nbsp;?</p>
              <p className="mt-2 text-sm leading-6 text-[#7C2D12]">
                Dans ce cas, AtriumOne n’a pas encore reçu de code OAuth. Il faut corriger l’accès de l’application dans Google Cloud.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#7C2D12]">
                <li>OAuth consent screen&nbsp;: mettez l’audience en <strong>External</strong>, ou connectez-vous avec un compte du même Workspace si l’app est <strong>Internal</strong>.</li>
                <li>Si l’app est en mode test, ajoutez votre adresse Gmail dans <strong>Test users</strong>.</li>
                <li>Dans le client OAuth Web, ajoutez exactement <strong>{diagnostic.redirectUri ?? "http://localhost:3000/api/google/callback"}</strong> aux redirect URIs autorisées.</li>
                <li>Activez les APIs Google Business Profile nécessaires et gardez le scope <strong>business.manage</strong>, obligatoire pour lire les fiches et avis.</li>
              </ul>
            </section>

            <section className="rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
              <div className="grid gap-3">
                {rows.map((row) => (
                  <div key={row.label} className="flex flex-col justify-between gap-1 rounded-2xl bg-[#FBFAFF] px-4 py-3 sm:flex-row sm:items-center">
                    <div className="text-sm font-semibold text-[#211432]">{row.label}</div>
                    <div className="text-sm text-[#6B617F]">{row.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="/api/google/connect" className="inline-flex items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
                  Reconnecter Google
                </a>
                <Link href="/integrations" className="inline-flex items-center justify-center rounded-lg bg-[#F3E8FF] px-4 py-2.5 text-sm font-semibold text-[#4C1D95] transition hover:bg-[#E9D5FF]">
                  Retour aux intégrations
                </Link>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
