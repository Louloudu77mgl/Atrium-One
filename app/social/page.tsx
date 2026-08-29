import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { getAutomationSettings, getSocialAutomationCadence } from "@/lib/automation-settings";
import { isDemoMode } from "@/lib/demo-mode";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { getAppNotifications } from "@/lib/notifications";
import { getFallbackReviewInsights, mapInsightRow } from "@/lib/review-insights";
import { getOrRefreshReviewInsights } from "@/lib/review-insights-server";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { getTopSocialRecommendations } from "@/lib/social-recommendations";
import { getSocialPosts } from "@/lib/social-posts";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { appShellStyles } from "@/lib/design-system";
import { SocialPageClient } from "./SocialPageClient";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function SocialPage({
  searchParams
}: {
  searchParams?: Promise<{ connect?: string; error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const [automationSettings, instagramConnection, posts] = await Promise.all([
    hasSupabaseEnv() && !isDemoMode() && merchant ? getAutomationSettings(merchant) : Promise.resolve(null),
    merchant ? getInstagramConnection(merchant) : Promise.resolve(null),
    hasSupabaseEnv() && !isDemoMode() ? getSocialPosts(merchant) : Promise.resolve([])
  ]);
  const storedInsights = hasSupabaseEnv() && !isDemoMode() && merchant
    ? await getOrRefreshReviewInsights(merchant, reviews)
    : null;
  const instagramConfigured = hasInstagramOAuthConfig();
  const cadence = getSocialAutomationCadence(automationSettings);
  const analysis = storedInsights
    ? mapInsightRow(storedInsights)
    : !hasSupabaseEnv() || isDemoMode()
      ? getFallbackReviewInsights(reviews)
      : null;
  const ideas = await getTopSocialRecommendations({
    analysis,
    reviews,
    merchant,
    posts
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
              isInstagramUnavailable={isInstagramUnavailable}
              instagramError={params?.error ?? null}
              instagramSaved={params?.saved === "instagram"}
              instagramConnectRequested={params?.connect === "instagram"}
              cadence={cadence}
              posts={posts}
              ideas={ideas}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
