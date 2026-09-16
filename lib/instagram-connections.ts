import type { SupabaseClient } from "@supabase/supabase-js";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, InstagramConnectionRow, MerchantRow } from "@/lib/supabase/types";

const instagramSummaryColumns = "id,merchant_id,instagram_username,connected_at,last_sync_at,last_error,status,token_expires_at,last_checked_at,updated_at";
const optionalInstagramConnectionColumns = ["instagram_account_type"] as const;

export async function getInstagramConnectionSummary(
  merchant?: MerchantRow | null,
  databaseClient?: SupabaseClient<Database>
): Promise<InstagramConnectionRow | null> {
  const currentMerchant = merchant ?? (await getMerchant());
  if (!currentMerchant) return null;

  const supabase = databaseClient ?? await createServerSupabaseClient();
  const result = await supabase
    .from("instagram_connections")
    .select(`${instagramSummaryColumns},instagram_account_type`)
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  let data = result.data;
  let error = result.error;

  // Keep authenticated pages available while an additive migration is being
  // rolled out. Account type is only required when publishing a Story.
  if (error && isMissingInstagramOptionalColumn(error.message)) {
    const fallback = await supabase
      .from("instagram_connections")
      .select(instagramSummaryColumns)
      .eq("merchant_id", currentMerchant.id)
      .maybeSingle();

    data = fallback.data ? { ...fallback.data, instagram_account_type: null } : null;
    error = fallback.error;
  }

  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) return null;
    throw new Error(error.message);
  }

  return data ? {
    ...data,
    instagram_account_id: null,
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    granted_scopes: [],
    page_id: null
  } : null;
}

export async function getInstagramConnection(
  merchant?: MerchantRow | null,
  databaseClient?: SupabaseClient<Database>
): Promise<InstagramConnectionRow | null> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return null;
  }

  const supabase = databaseClient ?? await createServerSupabaseClient();
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
  const merchantId = currentMerchant.id;
  const nextPayload = {
    ...payload,
    merchant_id: merchantId
  };

  const result = await writeInstagramConnection(nextPayload);

  if (!result.error) return result.data;

  if (isMissingInstagramOptionalColumn(result.error.message)) {
    const fallback = await writeInstagramConnection(stripOptionalInstagramConnectionColumns(nextPayload));
    if (!fallback.error) return fallback.data;
    throw new Error(fallback.error.message);
  }

  throw new Error(result.error.message);

  async function writeInstagramConnection(next: typeof nextPayload) {
    return existing
      ? await supabase
          .from("instagram_connections")
          .update(next)
          .eq("merchant_id", merchantId)
          .select("*")
          .single()
      : await supabase
          .from("instagram_connections")
          .insert(next)
          .select("*")
          .single();
  }
}

function isMissingInstagramOptionalColumn(message: string) {
  const lower = message.toLowerCase();
  return optionalInstagramConnectionColumns.some((column) => lower.includes(column))
    && (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find"));
}

function stripOptionalInstagramConnectionColumns<T extends Record<string, unknown>>(payload: T): T {
  const stripped = { ...payload };
  optionalInstagramConnectionColumns.forEach((column) => delete stripped[column]);
  return stripped;
}
