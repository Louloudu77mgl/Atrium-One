import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles } from "@/lib/design-system";
import { getAppNotifications } from "@/lib/notifications";
import { getRcuDashboardData } from "@/lib/rcu-data";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { RcuClient } from "./RcuClient";

export const dynamic = "force-dynamic";

export default async function RcuPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const rcuData = await getRcuDashboardData(merchant);

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="rcu" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <RcuClient merchant={merchant} customers={rcuData.customers} forms={rcuData.forms} />
        </main>
      </div>
    </div>
  );
}
