import { notFound } from "next/navigation";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MerchantRow, SocialPostRow } from "@/lib/supabase/types";
export { getPostStatusLabel } from "@/lib/social-post-utils";

export async function getSocialPosts(merchant?: MerchantRow | null): Promise<SocialPostRow[]> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      return [];
    }

    throw new Error(error.message);
  }

  return data;
}

export async function getSocialPostById(postId: string, merchant?: MerchantRow | null) {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    notFound();
  }

  return data;
}
