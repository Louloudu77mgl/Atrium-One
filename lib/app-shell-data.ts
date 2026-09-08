import { redirect } from "next/navigation";
import { getGoogleConnection } from "@/lib/google-connections";
import { getMerchant } from "@/lib/merchants";
import { reviews as mockReviews } from "@/lib/mock-data";
import { getReviews, getShellReviews } from "@/lib/reviews";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export async function getAppShellData({
  reviews: reviewMode = "full",
  google = true
}: {
  reviews?: "full" | "shell" | "none";
  google?: boolean;
} = {}) {
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
    google ? getGoogleConnection(merchant) : Promise.resolve(null),
    reviewMode === "full"
      ? getReviews(merchant)
      : reviewMode === "shell"
        ? getShellReviews(merchant)
        : Promise.resolve([])
  ]);

  return {
    reviews,
    merchant,
    googleConnection
  };
}
