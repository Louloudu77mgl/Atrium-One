import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { getAutomationSettings, getSocialAutomationCadence } from "@/lib/automation-settings";
import { isDemoMode } from "@/lib/demo-mode";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { hasMakeInstagramWebhookConfig } from "@/lib/make-instagram";
import { getAppNotifications } from "@/lib/notifications";
import { getFallbackReviewInsights } from "@/lib/review-insights";
import { getFreshReviewInsights } from "@/lib/review-insights-server";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { getMerchantMediaAssets } from "@/lib/social-gallery";
import { getTopSocialRecommendations } from "@/lib/social-recommendations";
import { getSocialPosts } from "@/lib/social-posts";
import { hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { appShellStyles } from "@/lib/design-system";
import { SocialPageClient } from "./SocialPageClient";

export const dynamic = "force-dynamic";

export default async function SocialPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const [automationSettings, instagramConnection, posts, mediaAssets] = await Promise.all([
    hasSupabaseEnv() && !isDemoMode() && merchant ? getAutomationSettings(merchant) : Promise.resolve(null),
    merchant ? getInstagramConnection(merchant) : Promise.resolve(null),
    hasSupabaseEnv() && !isDemoMode() ? getSocialPosts(merchant) : Promise.resolve([]),
    hasSupabaseEnv() && !isDemoMode() ? getMerchantMediaAssets(merchant) : Promise.resolve([])
  ]);
  const instagramConfigured = hasInstagramOAuthConfig();
  const cadence = getSocialAutomationCadence(automationSettings);
  const analysis = hasSupabaseEnv() && !isDemoMode() && merchant && reviews.length > 0
    ? await getFreshReviewInsights(reviews, merchant)
    : getFallbackReviewInsights(reviews);
  const ideas = getTopSocialRecommendations({
    analysis,
    reviews,
    merchant,
    mediaAssets
  });
  const isInstagramUnavailable = params?.error === "instagram_unavailable";

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="social" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className={appShellStyles.width}>
            <SocialPageClient
              merchant={merchant}
              reviews={reviews}
              automationSettings={automationSettings}
              instagramConnection={instagramConnection}
              instagramConfigured={instagramConfigured}
              makePublishingConfigured={hasMakeInstagramWebhookConfig()}
              schedulingConfigured={hasSupabaseAdminEnv() && Boolean(process.env.CRON_SECRET)}
              isInstagramUnavailable={isInstagramUnavailable}
              instagramError={params?.error ?? null}
              instagramSaved={params?.saved === "instagram"}
              cadence={cadence}
              posts={posts}
              ideas={ideas}
              mediaAssets={mediaAssets}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
