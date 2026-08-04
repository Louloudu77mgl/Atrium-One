import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles } from "@/lib/design-system";
import { getAppNotifications } from "@/lib/notifications";
import { getRcuDashboardData } from "@/lib/rcu-data";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { ClientsDatabaseClient } from "./ClientsDatabaseClient";

export const dynamic = "force-dynamic";

export default async function ClientsDatabasePage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const { customers } = await getRcuDashboardData(merchant);

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="clients" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <ClientsDatabaseClient customers={customers} />
        </main>
      </div>
    </div>
  );
}
