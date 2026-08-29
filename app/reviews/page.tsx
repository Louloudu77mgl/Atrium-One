import { getAutomationSettings } from "@/lib/automation-settings";
import { redirect } from "next/navigation";
import { ReviewsPageClient } from "./ReviewsPageClient";
import { getGoogleConnectionWithAutoSync } from "@/lib/google-review-auto-sync";
import { getMerchant } from "@/lib/merchants";
import { reviews as mockReviews } from "@/lib/mock-data";
import { getReviews } from "@/lib/reviews";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  if (!hasSupabaseEnv() || isDemoMode()) {
    return <ReviewsPageClient reviews={mockReviews} />;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const merchant = await getMerchant(user.id);

  if (!merchant) {
    redirect("/onboarding");
  }

  const googleConnection = await getGoogleConnectionWithAutoSync(merchant);
  const [reviews, automationSettings] = await Promise.all([
    getReviews(merchant),
    getAutomationSettings(merchant)
  ]);

  return <ReviewsPageClient reviews={reviews} merchant={merchant} googleConnection={googleConnection} automationSettings={automationSettings} />;
}
