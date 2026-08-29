import { redirect } from "next/navigation";
import { getGoogleConnection } from "@/lib/google-connections";
import { getMerchant } from "@/lib/merchants";
import { reviews as mockReviews } from "@/lib/mock-data";
import { getReviews } from "@/lib/reviews";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export async function getAppShellData() {
  if (!hasSupabaseEnv() || isDemoMode()) {
    return {
      reviews: mockReviews,
      merchant: null,
      googleConnection: null
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const merchant = await getMerchant(user.id);

  if (!merchant) {
    redirect("/onboarding");
  }

  const [googleConnection, reviews] = await Promise.all([
    getGoogleConnection(merchant),
    getReviews(merchant)
  ]);

  return {
    reviews,
    merchant,
    googleConnection
  };
}
