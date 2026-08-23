import type { SupabaseClient } from "@supabase/supabase-js";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, GmailConnectionRow, MerchantRow } from "@/lib/supabase/types";

type GmailSupabaseClient = SupabaseClient<Database>;

export async function getGmailConnection(
  merchant?: MerchantRow | null,
  providedClient?: GmailSupabaseClient
): Promise<GmailConnectionRow | null> {
  const currentMerchant = merchant ?? await getMerchant();
  if (!currentMerchant) return null;
  const supabase = providedClient ?? await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    if (isMissingGmailTable(error.message)) return null;
    throw new Error(error.message);
  }

  return data;
}

export async function upsertGmailConnection(
  payload: Partial<GmailConnectionRow> & Pick<GmailConnectionRow, "merchant_id">,
  merchant?: MerchantRow | null,
  providedClient?: GmailSupabaseClient
) {
  const currentMerchant = merchant ?? await getMerchant();
  if (!currentMerchant) throw new Error("Commerce introuvable.");
  const supabase = providedClient ?? await createServerSupabaseClient();
  const existing = await getGmailConnection(currentMerchant, supabase);
  const now = new Date().toISOString();
  const nextPayload = {
    ...payload,
    merchant_id: currentMerchant.id,
    updated_at: now
  };
  const query = existing
    ? supabase.from("gmail_connections").update(nextPayload).eq("merchant_id", currentMerchant.id)
    : supabase.from("gmail_connections").insert(nextPayload);
  const { data, error } = await query.select("*").single();

  if (error) {
    if (isMissingGmailTable(error.message)) {
      throw new Error("La connexion Gmail doit être activée dans la base AtriumOne.");
    }
    throw new Error(error.message);
  }

  return data;
}

export function isGmailConnectionReady(connection?: GmailConnectionRow | null) {
  return Boolean(
    connection?.status === "connected"
    && connection.gmail_address
    && (connection.refresh_token_encrypted || connection.access_token_encrypted)
  );
}

function isMissingGmailTable(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("gmail_connections") && (
    lower.includes("could not find")
    || lower.includes("does not exist")
    || lower.includes("schema cache")
  );
}
