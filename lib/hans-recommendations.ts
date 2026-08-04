import { recommendations as fallbackRecommendations } from "@/lib/mock-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { HansRecommendationRow, MerchantRow } from "@/lib/supabase/types";

export type HansRecommendation = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "done";
  completedAt?: string | null;
};

function fallbackRows(): HansRecommendation[] {
  return fallbackRecommendations.map((recommendation, index) => ({
    id: `fallback-${index}`,
    title: recommendation.title,
    description: recommendation.text,
    status: "todo"
  }));
}

function mapRow(row: HansRecommendationRow): HansRecommendation {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    completedAt: row.completed_at
  };
}

export async function getHansRecommendations(merchant?: MerchantRow | null): Promise<HansRecommendation[]> {
  if (!merchant) {
    return fallbackRows();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("hans_recommendations")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.message.includes("Could not find the table")) {
      return fallbackRows();
    }

    throw new Error(error.message);
  }

  if (data.length > 0) {
    return data.map(mapRow);
  }

  const seed = fallbackRecommendations.map((recommendation) => ({
    merchant_id: merchant.id,
    title: recommendation.title,
    description: recommendation.text,
    status: "todo" as const,
    completed_at: null
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("hans_recommendations")
    .insert(seed)
    .select("*")
    .order("created_at", { ascending: true });

  if (insertError) {
    return fallbackRows();
  }

  return inserted.map(mapRow);
}
