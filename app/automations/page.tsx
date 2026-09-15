import { Suspense } from "react";
import { Header } from "@/components/Header";
import { PageContentSkeleton } from "@/components/Skeleton";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { listAutomationExecutionLogs, listStoredAutomationFlows, listDeletedAutomationFlowIds } from "@/lib/automation-execution-store";
import { getAutomationSettings } from "@/lib/automation-settings";
import { appShellStyles } from "@/lib/design-system";
import { getEmailingDashboardData } from "@/lib/emailing-data";
import { getInstagramConnectionSummary } from "@/lib/instagram-connections";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { AutomationsWorkspace } from "./AutomationsWorkspace";

export const dynamic = "force-dynamic";

export default async function AutomationsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const [params, shell] = await Promise.all([searchParams, getAppShellData()]);
  const { reviews, merchant, googleConnection } = shell;
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const dataPromise = getAutomationsPageData(merchant, reviews);

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="automations" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <Suspense fallback={<PageContentSkeleton variant="automations" />}>
            <AutomationsPageContent
              dataPromise={dataPromise}
              merchant={merchant}
              reviews={reviews}
              counters={counters}
              googleConnection={googleConnection}
              savedFlag={params?.saved ?? null}
              errorMessage={params?.error ?? null}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function getAutomationsPageData(
  merchant: Awaited<ReturnType<typeof getAppShellData>>["merchant"],
  reviews: Awaited<ReturnType<typeof getAppShellData>>["reviews"]
) {
  return Promise.all([
    merchant ? getAutomationSettings(merchant) : Promise.resolve(null),
    merchant ? getInstagramConnectionSummary(merchant) : Promise.resolve(null),
    merchant ? listAutomationExecutionLogs(merchant.id).catch(() => []) : Promise.resolve([]),
    merchant ? listStoredAutomationFlows(merchant.id).catch(() => []) : Promise.resolve([]),
    merchant ? listDeletedAutomationFlowIds(merchant.id) : Promise.resolve([]),
    getEmailingDashboardData(merchant, reviews)
  ]);
}

async function AutomationsPageContent({
  dataPromise,
  merchant,
  reviews,
  counters,
  googleConnection,
  savedFlag,
  errorMessage
}: {
  dataPromise: ReturnType<typeof getAutomationsPageData>;
  merchant: Awaited<ReturnType<typeof getAppShellData>>["merchant"];
  reviews: Awaited<ReturnType<typeof getAppShellData>>["reviews"];
  counters: ReturnType<typeof getReviewCountersFromReviews>;
  googleConnection: Awaited<ReturnType<typeof getAppShellData>>["googleConnection"];
  savedFlag: string | null;
  errorMessage: string | null;
}) {
  const [settings, instagramConnection, automationRuns, storedFlows, deletedFlowIds, emailingData] = await dataPromise;
  return <AutomationsWorkspace merchant={merchant} reviews={reviews} reviewCounters={counters} googleConnection={googleConnection} instagramConnection={instagramConnection} instagramConfigured={hasInstagramOAuthConfig()} settings={settings} automationRuns={automationRuns} storedFlows={storedFlows} deletedFlowIds={deletedFlowIds} emailSubscribersCount={emailingData.subscribers.length} emailCampaignsCount={emailingData.campaigns.length} emailProviderReady={emailingData.providerReady} savedFlag={savedFlag} errorMessage={errorMessage} />;
}
