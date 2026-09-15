import { Suspense } from "react";
import { Header } from "@/components/Header";
import { PageContentSkeleton } from "@/components/Skeleton";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles } from "@/lib/design-system";
import { getAppNotifications } from "@/lib/notifications";
import { getRcuDashboardData } from "@/lib/rcu-data";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { ClientsDatabaseClient } from "./ClientsDatabaseClient";

export const dynamic = "force-dynamic";

export default async function ClientsDatabasePage() {
  const { reviews, merchant, googleConnection } = await getAppShellData({ reviews: "shell" });
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const dataPromise = getRcuDashboardData(merchant);

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="clients" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <Suspense fallback={<PageContentSkeleton variant="table" />}>
            <ClientsPageContent dataPromise={dataPromise} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

async function ClientsPageContent({ dataPromise }: { dataPromise: ReturnType<typeof getRcuDashboardData> }) {
  const { customers } = await dataPromise;
  return <ClientsDatabaseClient customers={customers} />;
}
