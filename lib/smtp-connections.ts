import type { SupabaseClient } from "@supabase/supabase-js";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptSmtpPassword } from "@/lib/smtp-crypto";
import type {
  Database,
  MerchantRow,
  SmtpConnectionRow
} from "@/lib/supabase/types";

type SmtpSupabaseClient = SupabaseClient<Database>;

export type SmtpConnectionInput = {
  provider: string;
  email_address: string;
  from_name?: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
};

export async function getSmtpConnection(
  merchant?: MerchantRow | null,
  providedClient?: SmtpSupabaseClient
): Promise<SmtpConnectionRow | null> {
  const currentMerchant = merchant ?? await getMerchant();

  if (!currentMerchant) return null;

  const supabase =
    providedClient ?? await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("smtp_connections")
    .select("*")
    .eq("merchant_id", currentMerchant.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function saveSmtpConnection(
  input: SmtpConnectionInput,
  merchant?: MerchantRow | null,
  providedClient?: SmtpSupabaseClient
) {
  const currentMerchant = merchant ?? await getMerchant();

  if (!currentMerchant) {
    throw new Error("Commerce introuvable.");
  }

  const supabase =
    providedClient ?? await createServerSupabaseClient();

  const existing = await getSmtpConnection(
    currentMerchant,
    supabase
  );

  const now = new Date().toISOString();

  const payload = {
    merchant_id: currentMerchant.id,
    provider: input.provider.trim().toLowerCase() || "custom",
    email_address: input.email_address.trim().toLowerCase(),
    from_name: input.from_name?.trim() || null,
    smtp_host: input.smtp_host.trim(),
    smtp_port: input.smtp_port,
    smtp_secure: input.smtp_secure,
    smtp_username: input.smtp_username.trim(),
    smtp_password_encrypted: encryptSmtpPassword(
      input.smtp_password
    ),
    status: "connected",
    last_error: null,
    last_checked_at: now,
    updated_at: now
  };

  const query = existing
    ? supabase
        .from("smtp_connections")
        .update(payload)
        .eq("merchant_id", currentMerchant.id)
    : supabase
        .from("smtp_connections")
        .insert(payload);

  const { data, error } = await query
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateSmtpConnectionStatus(
  payload: Partial<SmtpConnectionRow> &
    Pick<SmtpConnectionRow, "merchant_id">,
  merchant?: MerchantRow | null,
  providedClient?: SmtpSupabaseClient
) {
  const currentMerchant = merchant ?? await getMerchant();

  if (!currentMerchant) {
    throw new Error("Commerce introuvable.");
  }

  const supabase =
    providedClient ?? await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("smtp_connections")
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    })
    .eq("merchant_id", currentMerchant.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteSmtpConnection(
  merchant?: MerchantRow | null,
  providedClient?: SmtpSupabaseClient
) {
  const currentMerchant = merchant ?? await getMerchant();

  if (!currentMerchant) {
    throw new Error("Commerce introuvable.");
  }

  const supabase =
    providedClient ?? await createServerSupabaseClient();

  const { error } = await supabase
    .from("smtp_connections")
    .delete()
    .eq("merchant_id", currentMerchant.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function isSmtpConnectionReady(
  connection?: SmtpConnectionRow | null
) {
  return Boolean(
    connection?.status === "connected" &&
    connection.email_address &&
    connection.smtp_host &&
    connection.smtp_port &&
    connection.smtp_username &&
    connection.smtp_password_encrypted
  );
}
