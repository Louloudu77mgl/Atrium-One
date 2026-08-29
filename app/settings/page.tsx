import { getAutomationSettings } from "@/lib/automation-settings";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrandSettings, updateBrandSettings } from "@/lib/brand-settings";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getGoogleConnection } from "@/lib/google-connections";
import { updateMerchantProfile } from "@/lib/merchant-actions";
import { getMerchant } from "@/lib/merchants";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { getReviews } from "@/lib/reviews";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { appShellStyles } from "@/lib/design-system";
import { mapUserFacingError } from "@/lib/user-feedback";
import { logout } from "@/lib/auth/actions";
import { BrandStyleForm, MerchantIdentityForm } from "./SettingsClientForms";

export const dynamic = "force-dynamic";

const shellCard = "rounded-[20px] border border-[#EBE6DF] bg-white shadow-[0_1px_2px_rgba(23,19,31,0.03),0_6px_18px_rgba(23,19,31,0.04)]";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;

  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const merchant = await getMerchant();
  if (!merchant) {
    redirect("/onboarding");
  }

  const [googleConnection, reviews, brandSettings, automationSettings] = await Promise.all([
    getGoogleConnection(merchant),
    getReviews(),
    getBrandSettings(merchant),
    getAutomationSettings(merchant)
  ]);

  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const fullAutomationEnabled = Boolean(automationSettings?.reviews_auto_reply_enabled || automationSettings?.social_auto_publish_enabled);

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="settings" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className={appShellStyles.width}>
            <div className="mx-auto flex max-w-[1120px] flex-col gap-4">
              <section className={`${shellCard} px-8 py-[26px]`}>
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9A96A1]">Réglages</span>
                <h1 className="mt-1 text-[23px] font-extrabold text-[#17131F]">Les réglages essentiels de votre commerce.</h1>
                <p className="mt-1 text-[13.5px] text-[#6E6A76]">Mettez à jour vos informations, votre ton de communication et vos outils connectés.</p>
                <span className="mt-[14px] inline-flex rounded-full bg-[#F1ECFB] px-[13px] py-[5px] text-[11.5px] font-bold text-[#6E4DE0]">
                  {fullAutomationEnabled ? "Hans vous aide automatiquement" : "Vous gardez la main"}
                </span>
              </section>

              {params?.saved ? <div className="rounded-[12px] border border-[#EBE6DF] bg-[#F1ECFB] px-4 py-3 text-sm font-semibold text-[#6E4DE0]">Paramètres sauvegardés.</div> : null}
              {params?.error ? <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">{mapUserFacingError(params.error)}</div> : null}

              <section className="grid gap-4 md:grid-cols-2">
                <Link href="/automations" className={`${shellCard} flex items-start gap-[14px] px-6 py-[22px] transition hover:-translate-y-[1px] hover:border-[#6E4DE0]`}>
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-[#F1ECFB] text-[#6E4DE0]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M12 3l1.4 2.8 3.1.4-2.3 2.2.6 3.1L12 10l-2.8 1.5.6-3.1-2.3-2.2 3.1-.4L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M6 14.5h12M6 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </span>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9A96A1]">Hans</span>
                    <h2 className="mt-1 text-[16.5px] font-extrabold text-[#17131F]">Automatisations</h2>
                    <p className="mt-1 text-[13px] text-[#6E6A76]">Choisissez ce que Hans peut faire seul pour vous faire gagner du temps.</p>
                  </div>
                  <svg className="ml-auto mt-1 h-[18px] w-[18px] shrink-0 text-[#9A96A1]" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>

                <Link href="/integrations" className={`${shellCard} flex items-start gap-[14px] px-6 py-[22px] transition hover:-translate-y-[1px] hover:border-[#6E4DE0]`}>
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-[#F1ECFB] text-[#6E4DE0]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M9 15l6-6M10 6l1-1a3.5 3.5 0 0 1 5 5l-1 1M14 18l-1 1a3.5 3.5 0 0 1-5-5l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9A96A1]">Outils connectés</span>
                    <h2 className="mt-1 text-[16.5px] font-extrabold text-[#17131F]">Connexions</h2>
                    <p className="mt-1 text-[13px] text-[#6E6A76]">Connectez Google Business et Instagram.</p>
                  </div>
                  <svg className="ml-auto mt-1 h-[18px] w-[18px] shrink-0 text-[#9A96A1]" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
              </section>

              <section className={shellCard}>
                <div className="px-[30px] pb-[6px] pt-[26px]">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9A96A1]">Commerce</span>
                  <h1 className="mt-1 text-[21px] font-extrabold text-[#17131F]">Identité du commerce</h1>
                  <p className="mt-1 text-[13.5px] text-[#6E6A76]">Les informations essentielles utilisées par Hans dans vos réponses.</p>
                </div>
                <MerchantIdentityForm merchant={merchant} action={updateMerchantProfile} />
              </section>

              <section className={shellCard}>
                <div className="flex items-center gap-2 px-[30px] pt-[18px] text-[13px] font-bold text-[#6E4DE0]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-[14px] w-[14px]"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Réglages détaillés
                </div>
                <div className="px-[30px] pb-[6px] pt-[8px]">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9A96A1]">Réseaux sociaux</span>
                  <h1 className="mt-1 text-[21px] font-extrabold text-[#17131F]">Style des publications</h1>
                  <p className="mt-1 text-[13.5px] text-[#6E6A76]">Ces réglages servent uniquement à la création de posts sur les réseaux sociaux.</p>
                </div>
                <BrandStyleForm brandSettings={brandSettings} businessName={merchant.business_name} logoUrl={merchant.logo_url} action={updateBrandSettings} />
              </section>

              <section className={`${shellCard} flex flex-col gap-4 px-[30px] py-[24px] sm:flex-row sm:items-center sm:justify-between`}>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9A96A1]">Compte</span>
                  <h2 className="mt-1 text-[17px] font-extrabold text-[#17131F]">Se déconnecter d’AtriumOne</h2>
                  <p className="mt-1 text-[13px] text-[#6E6A76]">Vous devrez vous reconnecter pour accéder à votre espace.</p>
                </div>
                <form action={logout}>
                  <button type="submit" className="inline-flex items-center justify-center rounded-full border border-[#E4DBF6] bg-white px-[18px] py-[10px] text-[13.5px] font-semibold text-[#4C1D95] transition hover:bg-[#F5F0FF]">
                    Se déconnecter
                  </button>
                </form>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
