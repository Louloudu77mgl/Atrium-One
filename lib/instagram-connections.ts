import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InstagramConnectionRow, MerchantRow } from "@/lib/supabase/types";

export async function getInstagramConnection(merchant?: MerchantRow | null): Promise<InstagramConnectionRow | null> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("instagram_connections")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      return null;
    }

    throw new Error(error.message);
  }

  return data;
}

export async function upsertInstagramConnection(
  payload: Partial<InstagramConnectionRow> & Pick<InstagramConnectionRow, "merchant_id">,
  merchant?: MerchantRow | null
) {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    throw new Error("Commerce introuvable.");
  }

  const supabase = await createServerSupabaseClient();
  const existing = await getInstagramConnection(currentMerchant);
  const nextPayload = {
    ...payload,
    merchant_id: currentMerchant.id
  };

  const { data, error } = existing
    ? await supabase
        .from("instagram_connections")
        .update(nextPayload)
        .eq("merchant_id", currentMerchant.id)
        .select("*")
        .single()
    : await supabase
        .from("instagram_connections")
        .insert(nextPayload)
        .select("*")
        .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
