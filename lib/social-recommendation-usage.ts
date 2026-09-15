import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftIdeaInput } from "@/lib/social-drafts";
import { getRecommendationOrigin, readRecommendationOrigin } from "@/lib/social-recommendation-shared";
import type { Database, SocialPostRow, SocialRecommendationUsageRow } from "@/lib/supabase/types";

const STALE_RESERVATION_MS = 30 * 60 * 1000;

export type SocialRecommendationReservation = Pick<SocialRecommendationUsageRow, "id" | "merchant_id" | "theme_key" | "reservation_token">;

export class RecommendationAlreadyUsedError extends Error {
  constructor() {
    super("Cette recommandation est déjà utilisée par une autre publication. Choisissez une autre idée de Hans.");
    this.name = "RecommendationAlreadyUsedError";
  }
}

export function isHansSocialRecommendation(idea: DraftIdeaInput) {
  return Boolean(idea.sourcePainPoint || idea.sourceStrength || idea.localEvent || idea.seasonalMoment);
}

export async function reserveSocialRecommendation({
  merchantId,
  idea,
  supabaseClient
}: {
  merchantId: string;
  idea: DraftIdeaInput;
  supabaseClient: SupabaseClient<Database>;
}): Promise<SocialRecommendationReservation | null> {
  if (!isHansSocialRecommendation(idea)) return null;
  const origin = getRecommendationOrigin(idea);
  const reservationToken = randomUUID();
  const now = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from("social_recommendation_usages")
    .insert({
      merchant_id: merchantId,
      theme_key: origin.themeKey,
      source_type: origin.sourceType,
      source_label: origin.sourceLabel,
      recommendation_title: origin.title,
      event_date: origin.eventDate,
      status: "reserved",
      reservation_token: reservationToken,
      reserved_at: now,
      updated_at: now
    })
    .select("id,merchant_id,theme_key,reservation_token")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await supabaseClient
        .from("social_recommendation_usages")
        .select("id,merchant_id,theme_key,reservation_token,status,reserved_at")
        .eq("merchant_id", merchantId)
        .eq("theme_key", origin.themeKey)
        .maybeSingle();
      if (existingError) throw new Error(`Impossible de vérifier la recommandation Hans : ${existingError.message}`);
      const isStale = existing?.status === "reserved" && Date.now() - new Date(existing.reserved_at).getTime() >= STALE_RESERVATION_MS;
      if (existing && isStale) {
        const { data: reclaimed, error: reclaimError } = await supabaseClient
          .from("social_recommendation_usages")
          .update({
            source_type: origin.sourceType,
            source_label: origin.sourceLabel,
            recommendation_title: origin.title,
            event_date: origin.eventDate,
            reservation_token: reservationToken,
            reserved_at: now,
            updated_at: now
          })
          .eq("id", existing.id)
          .eq("status", "reserved")
          .eq("reservation_token", existing.reservation_token)
          .select("id,merchant_id,theme_key,reservation_token")
          .maybeSingle();
        if (reclaimError) throw new Error(`Impossible de reprendre la recommandation Hans : ${reclaimError.message}`);
        if (reclaimed) return reclaimed;
      }
      throw new RecommendationAlreadyUsedError();
    }
    throw new Error(`Impossible de réserver la recommandation Hans : ${error.message}`);
  }
  return data;
}

export async function attachSocialRecommendationToPost({
  reservation,
  post,
  supabaseClient
}: {
  reservation: SocialRecommendationReservation | null;
  post: Pick<SocialPostRow, "id" | "status" | "scheduled_at" | "published_at">;
  supabaseClient: SupabaseClient<Database>;
}) {
  if (!reservation) return;
  const now = new Date().toISOString();
  const status = lifecycleStatusForPost(post);
  const { data, error } = await supabaseClient
    .from("social_recommendation_usages")
    .update({
      status,
      social_post_id: post.id,
      used_at: now,
      scheduled_at: status === "scheduled" ? post.scheduled_at ?? now : null,
      published_at: status === "published" ? post.published_at ?? now : null,
      updated_at: now
    })
    .eq("id", reservation.id)
    .eq("merchant_id", reservation.merchant_id)
    .eq("reservation_token", reservation.reservation_token)
    .eq("status", "reserved")
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "La recommandation Hans n’a pas pu être associée au post.");
}

export async function releaseSocialRecommendationReservation(
  reservation: SocialRecommendationReservation | null,
  supabaseClient: SupabaseClient<Database>
) {
  if (!reservation) return;
  const { error } = await supabaseClient
    .from("social_recommendation_usages")
    .delete()
    .eq("id", reservation.id)
    .eq("merchant_id", reservation.merchant_id)
    .eq("reservation_token", reservation.reservation_token)
    .eq("status", "reserved");
  if (error) console.warn("[hans/recommendations] reservation_release_failed", { reservationId: reservation.id });
}

export async function syncSocialRecommendationLifecycleForPost(
  post: Pick<SocialPostRow, "id" | "merchant_id" | "status" | "scheduled_at" | "published_at" | "builder_state">,
  supabaseClient: SupabaseClient<Database>
) {
  const origin = readRecommendationOrigin(post.builder_state);
  if (!origin) return;
  const status = lifecycleStatusForPost(post);
  const now = new Date().toISOString();
  const { error } = await supabaseClient
    .from("social_recommendation_usages")
    .upsert({
      merchant_id: post.merchant_id,
      theme_key: origin.themeKey,
      source_type: origin.sourceType,
      source_label: origin.sourceLabel,
      recommendation_title: origin.title,
      event_date: origin.eventDate,
      status,
      reservation_token: randomUUID(),
      social_post_id: post.id,
      used_at: now,
      scheduled_at: status === "scheduled" ? post.scheduled_at ?? now : null,
      published_at: status === "published" ? post.published_at ?? now : null,
      updated_at: now
    }, { onConflict: "merchant_id,theme_key", ignoreDuplicates: false });
  if (error) throw new Error(`Cycle de vie de la recommandation non sauvegardé : ${error.message}`);
}

export async function releaseSocialRecommendationForPost({
  merchantId,
  postId,
  supabaseClient
}: {
  merchantId: string;
  postId: string;
  supabaseClient: SupabaseClient<Database>;
}) {
  const { error } = await supabaseClient
    .from("social_recommendation_usages")
    .delete()
    .eq("merchant_id", merchantId)
    .eq("social_post_id", postId)
    .neq("status", "published");
  if (error) throw new Error(error.message);
}

function lifecycleStatusForPost(post: Pick<SocialPostRow, "status" | "scheduled_at" | "published_at">): SocialRecommendationUsageRow["status"] {
  if (post.status === "published" || post.published_at) return "published";
  if (post.status === "scheduled" || post.status === "publishing" || (post.status === "failed" && post.scheduled_at)) return "scheduled";
  return "used";
}
