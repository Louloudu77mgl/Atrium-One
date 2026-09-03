import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, MerchantRow, SocialPostRow } from "@/lib/supabase/types";
export { getPostStatusLabel } from "@/lib/social-post-utils";

export async function getSocialPosts(merchant?: MerchantRow | null, client?: SupabaseClient<Database>): Promise<SocialPostRow[]> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return [];
  }

  const supabase = client ?? await createServerSupabaseClient();
  const posts: SocialPostRow[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("social_posts").select("*").eq("merchant_id", currentMerchant.id)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + pageSize - 1);
    if (error) {
      if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) return [];
      throw new Error(error.message);
    }
    posts.push(...data);
    if (data.length < pageSize) break;
  }
  return posts.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
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
