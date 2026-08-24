import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { listAutomationExecutionLogs, listStoredAutomationFlows } from "@/lib/automation-execution-store";
import { getAutomationSettings } from "@/lib/automation-settings";
import { appShellStyles } from "@/lib/design-system";
import { getEmailingDashboardData } from "@/lib/emailing-data";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { getSocialPosts } from "@/lib/social-posts";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { AutomationsWorkspace } from "./AutomationsWorkspace";

export const dynamic = "force-dynamic";

export default async function AutomationsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const settings = merchant ? await getAutomationSettings(merchant) : null;
  const instagramConnection = merchant ? await getInstagramConnection(merchant) : null;
  const socialPosts = merchant ? await getSocialPosts(merchant) : [];
  const automationRuns = merchant ? await listAutomationExecutionLogs(merchant.id).catch(() => []) : [];
  const storedFlows = merchant ? await listStoredAutomationFlows(merchant.id).catch(() => []) : [];
  const emailingData = await getEmailingDashboardData(merchant, reviews);

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="automations" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <AutomationsWorkspace
            merchant={merchant}
            reviews={reviews}
            reviewCounters={counters}
            googleConnection={googleConnection}
            instagramConnection={instagramConnection}
            instagramConfigured={hasInstagramOAuthConfig()}
            settings={settings}
            automationRuns={automationRuns}
            storedFlows={storedFlows}
            socialPosts={socialPosts}
            emailSubscribersCount={emailingData.subscribers.length}
            emailCampaignsCount={emailingData.campaigns.length}
            emailProviderReady={emailingData.providerReady}
            savedFlag={params?.saved ?? null}
            errorMessage={params?.error ?? null}
          />
        </main>
      </div>
    </div>
  );
}
