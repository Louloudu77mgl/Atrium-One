import type { SupabaseClient } from "@supabase/supabase-js";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, GoogleConnectionRow, MerchantRow } from "@/lib/supabase/types";

const optionalGoogleConnectionColumns = ["granted_scopes", "last_error"] as const;

export function toPublicGoogleConnection(connection: GoogleConnectionRow | null): GoogleConnectionRow | null {
  return connection ? { ...connection, access_token_encrypted: null, refresh_token_encrypted: null } : null;
}

export async function getGoogleConnectionSummary(
  merchant?: MerchantRow | null,
  databaseClient?: SupabaseClient<Database>
): Promise<GoogleConnectionRow | null> {
  const currentMerchant = merchant ?? (await getMerchant());
  if (!currentMerchant) return null;

  const supabase = databaseClient ?? await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("google_connections")
    .select("id,merchant_id,google_account_email,google_location_name,google_location_id,connected_at,last_sync_at,status")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    if (error.message.includes("Could not find the table")) return null;
    throw new Error(error.message);
  }

  return data ? {
    ...data,
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    granted_scopes: [],
    last_error: null
  } : null;
}

export async function getGoogleConnection(
  merchant?: MerchantRow | null,
  databaseClient?: SupabaseClient<Database>
): Promise<GoogleConnectionRow | null> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return null;
  }

  const supabase = databaseClient ?? await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("google_connections")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    if (error.message.includes("Could not find the table")) {
      return null;
    }

    throw new Error(error.message);
  }

  return data;
}

export async function upsertGoogleConnection(
  payload: Partial<GoogleConnectionRow> & Pick<GoogleConnectionRow, "merchant_id">,
  merchant?: MerchantRow | null,
  databaseClient?: SupabaseClient<Database>
) {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    throw new Error("Commerce introuvable.");
  }

  const supabase = databaseClient ?? await createServerSupabaseClient();
  const existing = await getGoogleConnection(currentMerchant, supabase);
  const nextPayload = {
    ...payload,
    merchant_id: currentMerchant.id
  };

  const { data, error } = await writeGoogleConnection({
    existing: Boolean(existing),
    merchantId: currentMerchant.id,
    payload: nextPayload
  });

  if (!error) {
    return data;
  }

  if (isSchemaCacheError(error.message)) {
    const fallbackPayload = stripOptionalGoogleConnectionColumns(nextPayload);
    const fallback = await writeGoogleConnection({
      existing: Boolean(existing),
      merchantId: currentMerchant.id,
      payload: fallbackPayload
    });

    if (!fallback.error) {
      console.warn("[google-connections] saved without optional columns", {
        omitted: optionalGoogleConnectionColumns,
        originalError: error.message
      });
      return fallback.data;
    }

    throw new Error(fallback.error.message);
  }

  throw new Error(error.message);

  async function writeGoogleConnection({
    existing,
    merchantId,
    payload
  }: {
    existing: boolean;
    merchantId: string;
    payload: Partial<GoogleConnectionRow> & Pick<GoogleConnectionRow, "merchant_id">;
  }) {
    return existing
    ? await supabase
        .from("google_connections")
        .update(payload)
        .eq("merchant_id", merchantId)
        .select("*")
        .single()
    : await supabase
        .from("google_connections")
        .insert(payload)
        .select("*")
        .single();
  }
}

function isSchemaCacheError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("could not find") && lower.includes("column");
}

function stripOptionalGoogleConnectionColumns(
  payload: Partial<GoogleConnectionRow> & Pick<GoogleConnectionRow, "merchant_id">
) {
  const stripped = { ...payload } as Record<string, unknown>;

  optionalGoogleConnectionColumns.forEach((column) => {
    delete stripped[column];
  });

  return stripped as Partial<GoogleConnectionRow> & Pick<GoogleConnectionRow, "merchant_id">;
}
