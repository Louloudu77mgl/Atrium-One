import "server-only";

import { randomUUID } from "node:crypto";
import { ensureAutomatedSocialDrafts } from "@/lib/social-automation";
import { normalizeSocialAutomationWindow } from "@/lib/social-automation-shared";
import { recommendationWeek } from "@/lib/social-recommendation-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MerchantAutomationSettingsRow, SocialAutomationWeeklyRunRow } from "@/lib/supabase/types";

const STALE_RUN_MS = 20 * 60 * 1000;

export type WeeklySocialAutomationResult = {
  merchantId: string;
  status: "completed" | "skipped" | "failed";
  posts?: number;
  reason?: string;
};

export async function runWeeklySocialAutomations(referenceDate = new Date()) {
  const supabase = createSupabaseAdminClient();
  const weekStart = recommendationWeek(referenceDate);
  const { data: settingsRows, error: settingsError } = await supabase
    .from("merchant_automation_settings")
    .select("*")
    .eq("social_auto_publish_enabled", true);

  if (settingsError) throw new Error(settingsError.message);
  const settings = settingsRows ?? [];
  if (!settings.length) return [];

  const { data: merchants, error: merchantsError } = await supabase
    .from("merchants")
    .select("*")
    .in("id", settings.map((item) => item.merchant_id));
  if (merchantsError) throw new Error(merchantsError.message);
  const merchantsById = new Map((merchants ?? []).map((merchant) => [merchant.id, merchant]));
  const results: WeeklySocialAutomationResult[] = [];

  for (const merchantSettings of settings) {
    const merchant = merchantsById.get(merchantSettings.merchant_id);
    if (!merchant) {
      results.push({ merchantId: merchantSettings.merchant_id, status: "failed", reason: "Commerce introuvable." });
      continue;
    }

    const claim = await claimWeeklyRun(merchantSettings, weekStart, referenceDate);
    if (!claim) {
      results.push({ merchantId: merchant.id, status: "skipped", reason: "Semaine déjà traitée ou exécution en cours." });
      continue;
    }

    try {
      const posts = await ensureAutomatedSocialDrafts({ merchant, settings: merchantSettings, supabaseClient: supabase });
      const expectedPosts = normalizeSocialAutomationWindow(merchantSettings).postsPerCycle;
      if (posts.length < expectedPosts) {
        throw new Error(`${posts.length} publication(s) sur ${expectedPosts} préparée(s) : Hans réessaiera dès que de nouvelles recommandations seront disponibles.`);
      }
      const completedAt = new Date().toISOString();
      const { error } = await supabase
        .from("social_automation_weekly_runs")
        .update({ status: "completed", completed_at: completedAt, error_message: null, created_posts: posts.length, updated_at: completedAt })
        .eq("id", claim.id)
        .eq("run_token", claim.run_token);
      if (error) throw new Error(error.message);
      results.push({ merchantId: merchant.id, status: "completed", posts: posts.length });
    } catch (error) {
      const failedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Automatisation Instagram hebdomadaire impossible.";
      await supabase
        .from("social_automation_weekly_runs")
        .update({ status: "failed", completed_at: null, error_message: message.slice(0, 1_000), updated_at: failedAt })
        .eq("id", claim.id)
        .eq("run_token", claim.run_token);
      results.push({ merchantId: merchant.id, status: "failed", reason: message });
    }
  }

  return results;

  async function claimWeeklyRun(
    merchantSettings: MerchantAutomationSettingsRow,
    currentWeek: string,
    now: Date
  ): Promise<SocialAutomationWeeklyRunRow | null> {
    const runToken = randomUUID();
    const nowIso = now.toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from("social_automation_weekly_runs")
      .insert({ merchant_id: merchantSettings.merchant_id, week_start: currentWeek, status: "running", run_token: runToken, started_at: nowIso, updated_at: nowIso })
      .select("*")
      .single();
    if (!insertError && inserted) return inserted;
    if (insertError?.code !== "23505") throw new Error(insertError?.message ?? "Impossible de démarrer l’automatisation hebdomadaire.");

    const { data: existing, error: existingError } = await supabase
      .from("social_automation_weekly_runs")
      .select("*")
      .eq("merchant_id", merchantSettings.merchant_id)
      .eq("week_start", currentWeek)
      .single();
    if (existingError) throw new Error(existingError.message);
    if (existing.status === "completed") return null;
    if (existing.status === "running" && now.getTime() - new Date(existing.started_at).getTime() < STALE_RUN_MS) return null;

    const { data: reclaimed, error: reclaimError } = await supabase
      .from("social_automation_weekly_runs")
      .update({ status: "running", run_token: runToken, started_at: nowIso, completed_at: null, error_message: null, created_posts: 0, updated_at: nowIso })
      .eq("id", existing.id)
      .eq("run_token", existing.run_token)
      .select("*")
      .maybeSingle();
    if (reclaimError) throw new Error(reclaimError.message);
    return reclaimed;
  }
}
