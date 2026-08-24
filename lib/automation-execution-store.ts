import { randomUUID } from "crypto";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import type { MerchantAutomationSettingsRow } from "@/lib/supabase/types";

const AUTOMATION_BUCKET = "automation-data";

export type AutomationExecutionLog = {
  id: string;
  merchant_id: string;
  automation_key: "google_reviews";
  local_review_id?: string | null;
  review_name?: string | null;
  customer_name?: string | null;
  rating?: number | null;
  status: "published" | "drafted" | "skipped" | "error";
  message: string;
  created_at: string;
};

type StoredAutomationSettings = Partial<MerchantAutomationSettingsRow> & {
  merchant_id: string;
  updated_at: string;
};

let bucketPromise: Promise<void> | null = null;

async function ensureAutomationBucket() {
  if (!hasSupabaseAdminEnv()) throw new Error("Configuration Supabase admin manquante.");
  if (bucketPromise) return bucketPromise;

  bucketPromise = (async () => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.storage.getBucket(AUTOMATION_BUCKET);
    if (data) return;

    const { error } = await supabase.storage.createBucket(AUTOMATION_BUCKET, {
      public: false,
      fileSizeLimit: 1024 * 1024,
      allowedMimeTypes: ["application/json"]
    });
    if (error && !error.message.toLowerCase().includes("already exists")) throw new Error(error.message);
  })().catch((error) => {
    bucketPromise = null;
    throw error;
  });

  return bucketPromise;
}

async function uploadJson(path: string, value: unknown, upsert: boolean) {
  await ensureAutomationBucket();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(AUTOMATION_BUCKET).upload(
    path,
    Buffer.from(JSON.stringify(value)),
    { contentType: "application/json", cacheControl: "0", upsert }
  );
  if (error) throw new Error(error.message);
}

async function downloadJson<T>(path: string) {
  await ensureAutomationBucket();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).download(path);
  if (error || !data) return null;

  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

export async function saveStoredAutomationSettings(
  merchantId: string,
  settings: Partial<MerchantAutomationSettingsRow>
) {
  const stored: StoredAutomationSettings = {
    ...settings,
    merchant_id: merchantId,
    updated_at: settings.updated_at ?? new Date().toISOString()
  };
  await uploadJson(`merchants/${merchantId}/settings.json`, stored, true);
  return stored;
}

export async function getStoredAutomationSettings(merchantId: string) {
  return downloadJson<StoredAutomationSettings>(`merchants/${merchantId}/settings.json`);
}

export async function saveAutomationExecutionLog(
  input: Omit<AutomationExecutionLog, "id" | "created_at"> & Partial<Pick<AutomationExecutionLog, "id" | "created_at">>
) {
  const log: AutomationExecutionLog = {
    ...input,
    id: input.id ?? randomUUID(),
    created_at: input.created_at ?? new Date().toISOString()
  };
  const filename = `${log.created_at.replace(/[:.]/g, "-")}-${log.id}.json`;
  await uploadJson(`merchants/${log.merchant_id}/runs/${filename}`, log, false);
  return log;
}

export async function listAutomationExecutionLogs(merchantId: string, limit = 100) {
  await ensureAutomationBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/runs`;
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).list(prefix, {
    limit,
    sortBy: { column: "created_at", order: "desc" }
  });
  if (error) throw new Error(error.message);

  const logs = await Promise.all(
    (data ?? [])
      .filter((item) => item.name.endsWith(".json"))
      .map((item) => downloadJson<AutomationExecutionLog>(`${prefix}/${item.name}`))
  );

  return logs
    .filter((log): log is AutomationExecutionLog => Boolean(log && log.merchant_id === merchantId))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}
