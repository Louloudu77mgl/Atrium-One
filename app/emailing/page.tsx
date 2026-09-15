import { Suspense } from "react";
import { Header } from "@/components/Header";
import { PageContentSkeleton } from "@/components/Skeleton";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles } from "@/lib/design-system";
import { getEmailingDashboardData } from "@/lib/emailing-data";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { EmailingClient } from "./EmailingClient";

export const dynamic = "force-dynamic";

export default async function EmailingPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; gmail_error?: string }>;
}) {
  const [params, shell] = await Promise.all([searchParams, getAppShellData()]);
  const { reviews, merchant, googleConnection } = shell;
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const dataPromise = getEmailingDashboardData(merchant, reviews);
  return (
    <div className={appShellStyles.page}>
      <Sidebar active="emailing" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <Suspense fallback={<PageContentSkeleton variant="campaigns" />}>
            <EmailingPageContent dataPromise={dataPromise} merchant={merchant} gmailError={params?.gmail_error} gmailConnectedNotice={params?.saved === "gmail"} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

async function EmailingPageContent({
  dataPromise,
  merchant,
  gmailError,
  gmailConnectedNotice
}: {
  dataPromise: ReturnType<typeof getEmailingDashboardData>;
  merchant: Awaited<ReturnType<typeof getAppShellData>>["merchant"];
  gmailError?: string;
  gmailConnectedNotice: boolean;
}) {
  const data = await dataPromise;
  return <EmailingClient merchant={merchant} brand={data.brand} subscribers={data.subscribers} initialCampaigns={data.campaigns} providerReady={data.providerReady} providerAddress={data.providerAddress} providerStatus={data.providerStatus} providerError={gmailError ?? data.providerError} gmailConnectedNotice={gmailConnectedNotice} />;
}
