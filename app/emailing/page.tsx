import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles } from "@/lib/design-system";
import { getEmailingDashboardData } from "@/lib/emailing-data";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { EmailingClient } from "./EmailingClient";

export const dynamic = "force-dynamic";

export default async function EmailingPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const data = await getEmailingDashboardData(merchant, reviews);
  return (
    <div className={appShellStyles.page}>
      <Sidebar active="emailing" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}><EmailingClient merchant={merchant} brand={data.brand} subscribers={data.subscribers} initialCampaigns={data.campaigns} providerReady={data.providerReady} /></main>
      </div>
    </div>
  );
}
