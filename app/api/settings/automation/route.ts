import { NextResponse } from "next/server";
import { upsertAutomationSettings } from "@/lib/automation-settings";
import { getMerchant } from "@/lib/merchants";
import { runReviewAutomationsForMerchant } from "@/lib/review-automation-runner";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  }

  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  }

  const payload = await request.json() as {
    reviews_auto_reply_enabled?: boolean;
    review_automation_mode?: "disabled" | "semi_automatic" | "automatic_guarded";
    reviews_five_star_action?: "disabled" | "validation" | "automatic";
    reviews_four_star_action?: "disabled" | "validation" | "automatic";
    reviews_three_star_action?: "disabled" | "validation" | "automatic";
    reviews_one_two_star_action?: "disabled" | "validation" | "automatic";
    always_validate_negative_reviews?: boolean;
    block_sensitive_reviews?: boolean;
    sensitive_keywords?: string[];
    social_auto_publish_enabled?: boolean;
    social_auto_publish_live?: boolean;
    social_posts_per_week?: number;
    social_posts_per_cycle?: number;
    social_cycle_weeks?: number;
  };

  try {
    const settings = await upsertAutomationSettings({
      reviews_auto_reply_enabled: payload.reviews_auto_reply_enabled,
      review_automation_mode: payload.review_automation_mode,
      reviews_five_star_action: payload.reviews_five_star_action,
      reviews_four_star_action: payload.reviews_four_star_action,
      reviews_three_star_action: payload.reviews_three_star_action,
      reviews_one_two_star_action: payload.reviews_one_two_star_action,
      always_validate_negative_reviews: payload.always_validate_negative_reviews,
      block_sensitive_reviews: payload.block_sensitive_reviews,
      sensitive_keywords: payload.sensitive_keywords,
      social_auto_publish_enabled: payload.social_auto_publish_enabled,
      social_auto_publish_live: payload.social_auto_publish_live,
      social_posts_per_week: payload.social_posts_per_week,
      social_posts_per_cycle: payload.social_posts_per_cycle,
      social_cycle_weeks: payload.social_cycle_weeks
    }, merchant);

    const shouldRunReviewAutomation = payload.reviews_auto_reply_enabled === true
      || Boolean(payload.review_automation_mode && payload.review_automation_mode !== "disabled");
    const automationResults = shouldRunReviewAutomation
      ? await runReviewAutomationsForMerchant(merchant.id, 5)
      : [];

    return NextResponse.json({ settings, automationResults });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d’enregistrer l’automatisation." },
      { status: 500 }
    );
  }
}
