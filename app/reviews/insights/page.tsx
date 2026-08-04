import { InsightsPageClient } from "./InsightsPageClient";
import { getAutomationSettings, getReviewAutomationSummary, getSocialAutomationCadence } from "@/lib/automation-settings";
import { getAppShellData } from "@/lib/app-shell-data";
import { isDemoMode } from "@/lib/demo-mode";
import { getFallbackReviewInsights, mapInsightRow, prepareReviewInsightsForDisplay } from "@/lib/review-insights";
import { getStoredReviewInsights } from "@/lib/review-insights-server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ReviewInsightsPage() {
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const storedInsights = hasSupabaseEnv() && !isDemoMode() ? await getStoredReviewInsights(merchant) : null;
  const automationSettings = hasSupabaseEnv() && !isDemoMode() && merchant ? await getAutomationSettings(merchant) : null;
  const initialAnalysis = storedInsights
    ? prepareReviewInsightsForDisplay(mapInsightRow(storedInsights), reviews)
    : getFallbackReviewInsights(reviews);

  return (
    <InsightsPageClient
      reviews={reviews}
      merchant={merchant}
      googleConnection={googleConnection}
      initialAnalysis={initialAnalysis}
      initialUpdatedAt={storedInsights?.updated_at ?? null}
      reviewAutomationSummary={getReviewAutomationSummary(automationSettings)}
      socialAutomationSummary={automationSettings?.social_auto_publish_enabled
        ? `Hans prépare ${getSocialAutomationCadence(automationSettings).postsPerCycle} post${getSocialAutomationCadence(automationSettings).postsPerCycle > 1 ? "s" : ""} toutes les ${getSocialAutomationCadence(automationSettings).cycleWeeks} semaine${getSocialAutomationCadence(automationSettings).cycleWeeks > 1 ? "s" : ""}.`
        : "Automatisation Instagram désactivée pour le moment."}
      reviewAutomationEnabled={Boolean(automationSettings && automationSettings.review_automation_mode !== "disabled")}
      socialAutomationEnabled={Boolean(automationSettings?.social_auto_publish_enabled)}
      shouldAutoAnalyze={false}
    />
  );
}
