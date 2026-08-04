import Link from "next/link";
import { Header } from "@/components/Header";
import { Icon } from "@/components/icons";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles, buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";

export const dynamic = "force-dynamic";

export default async function SmsCampaignsPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  return (
    <div className={appShellStyles.page}>
      <Sidebar active="sms" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className={`${appShellStyles.width} min-h-[70vh] place-content-center`}>
            <section className={`${surfaceStyles.section} mx-auto max-w-2xl p-8 text-center sm:p-12`}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F3E8FF] text-[#6D28D9]"><Icon name="lock" className="h-8 w-8" /></div>
              <div className={`${typographyStyles.kicker} mt-6`}>SMS</div>
              <h1 className={`${typographyStyles.h1} mt-2`}>Disponible prochainement</h1>
              <p className="mx-auto mt-4 max-w-lg text-sm font-medium leading-6 text-[#6B617F]">Le module SMS est volontairement verrouillé dans cette version. AtriumOne concentre maintenant toute l’expérience de campagne sur un e-mailing simple piloté par Hans.</p>
              <Link href="/emailing" className={`${buttonStyles.primary} mt-7 gap-2`}><Icon name="mail" className="h-4 w-4" />Ouvrir l’E-mailing</Link>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
