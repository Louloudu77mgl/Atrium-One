import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { getAutomationSettings } from "@/lib/automation-settings";
import { appShellStyles } from "@/lib/design-system";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { getSocialPosts } from "@/lib/social-posts";
import { AutomationsClient } from "./AutomationsClient";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const settings = merchant ? await getAutomationSettings(merchant) : null;
  const instagramConnection = merchant ? await getInstagramConnection(merchant) : null;
  const socialPosts = merchant ? await getSocialPosts(merchant) : [];

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="automations" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <AutomationsClient
            merchant={merchant}
            reviews={reviews}
            googleConnection={googleConnection}
            instagramConnection={instagramConnection}
            settings={settings}
            socialPosts={socialPosts}
          />
        </main>
      </div>
    </div>
  );
}
