import { createHash, randomUUID } from "crypto";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import type { MerchantAutomationSettingsRow } from "@/lib/supabase/types";

const AUTOMATION_BUCKET = "automation-data";

export type AutomationExecutionLog = {
  id: string;
  merchant_id: string;
  automation_key: "google_reviews" | "flow_event";
  local_review_id?: string | null;
  review_name?: string | null;
  customer_name?: string | null;
  rating?: number | null;
  status: "published" | "drafted" | "skipped" | "error";
  message: string;
  created_at: string;
  flow_id?: string | null;
  flow_title?: string | null;
  steps?: Array<{
    node_id: string;
    node_type: string;
    title: string;
    status: "success" | "waiting" | "skipped" | "error";
    result: string;
  }>;
};

export type StoredAutomationFlow = {
  id: string;
  title: string;
  description: string;
  summary: string;
  channel: string;
  category?: string;
  installMinutes?: number;
  difficulty?: "Simple" | "Intermédiaire" | "Avancé";
  illustration?: string;
  status: "active" | "paused" | "draft" | "error" | "incomplete";
  source: "template" | "manual" | "hans" | "existing";
  nodes: Array<{
    id: string;
    type: string;
    category: "trigger" | "condition" | "action" | "delay" | "control";
    title: string;
    description: string;
    icon: string;
    color: string;
    x: number;
    y: number;
    width?: number;
    config: Record<string, string | number | boolean>;
    mode?: "automatic" | "semi_automatic" | "draft_only";
    status?: "idle" | "ready" | "warning" | "error";
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    branch: "default" | "yes" | "no";
    label?: string;
  }>;
  updatedAt: string;
  lastSavedLabel?: string;
  version: number;
  validationIssues: Array<{
    id: string;
    level: "error" | "warning";
    message: string;
    nodeId?: string;
    actionLabel?: string;
    actionHref?: string;
  }>;
  executionHistory: unknown[];
  merchant_id?: string;
  saved_at?: string;
};

export type StoredGoogleReviewIndex = {
  source_review_id: string;
  local_review_id: string;
  create_time: string | null;
  update_time: string | null;
  has_reply: boolean;
  synced_at: string;
};

export type StoredAutomationFlowRuntimeState = {
  merchant_id: string;
  flow_id: string;
  last_checked_at: string;
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

function safeFlowId(flowId: string) {
  const normalized = flowId.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 160);
  if (!normalized) throw new Error("Identifiant de scénario invalide.");
  return normalized;
}

export async function saveStoredAutomationFlow(merchantId: string, flow: StoredAutomationFlow) {
  const path = `merchants/${merchantId}/flows/${safeFlowId(flow.id)}.json`;
  const existing = await downloadJson<StoredAutomationFlow>(path);
  if (existing?.updatedAt && flow.updatedAt && existing.updatedAt > flow.updatedAt) {
    throw new Error("Une version plus récente de cette automatisation existe déjà. Rechargez la page avant de poursuivre.");
  }
  const stored: StoredAutomationFlow = {
    ...flow,
    title: flow.title.trim(),
    merchant_id: merchantId,
    saved_at: new Date().toISOString(),
    executionHistory: []
  };
  await uploadJson(path, stored, true);
  return stored;
}

export async function listStoredAutomationFlows(merchantId: string) {
  await ensureAutomationBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/flows`;
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).list(prefix, {
    limit: 200,
    sortBy: { column: "created_at", order: "asc" }
  });
  if (error) throw new Error(error.message);

  const flows = await Promise.all(
    (data ?? [])
      .filter((item) => item.name.endsWith(".json"))
      .map((item) => downloadJson<StoredAutomationFlow>(`${prefix}/${item.name}`))
  );

  return flows.filter((flow): flow is StoredAutomationFlow => Boolean(
    flow &&
    flow.merchant_id === merchantId &&
    typeof flow.id === "string" &&
    Array.isArray(flow.nodes) &&
    Array.isArray(flow.edges)
  ));
}

export async function getStoredAutomationFlowRuntimeState(merchantId: string, flowId: string) {
  return downloadJson<StoredAutomationFlowRuntimeState>(
    `merchants/${merchantId}/flow-state/${safeFlowId(flowId)}.json`
  );
}

export async function saveStoredAutomationFlowRuntimeState(
  merchantId: string,
  flowId: string,
  lastCheckedAt = new Date().toISOString()
) {
  const state: StoredAutomationFlowRuntimeState = {
    merchant_id: merchantId,
    flow_id: flowId,
    last_checked_at: lastCheckedAt
  };
  await uploadJson(`merchants/${merchantId}/flow-state/${safeFlowId(flowId)}.json`, state, true);
  return state;
}

export async function deleteStoredAutomationFlow(merchantId: string, flowId: string) {
  await ensureAutomationBucket();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(AUTOMATION_BUCKET)
    .remove([`merchants/${merchantId}/flows/${safeFlowId(flowId)}.json`]);
  if (error) throw new Error(error.message);
}

function googleReviewIndexPath(merchantId: string, sourceReviewId: string) {
  const key = createHash("sha256").update(sourceReviewId).digest("hex");
  return `merchants/${merchantId}/google-reviews/${key}.json`;
}

export async function getStoredGoogleReviewIndex(merchantId: string, sourceReviewId: string) {
  return downloadJson<StoredGoogleReviewIndex>(googleReviewIndexPath(merchantId, sourceReviewId));
}

export async function saveStoredGoogleReviewIndex(
  merchantId: string,
  input: Omit<StoredGoogleReviewIndex, "synced_at"> & Partial<Pick<StoredGoogleReviewIndex, "synced_at">>
) {
  const record: StoredGoogleReviewIndex = {
    ...input,
    synced_at: input.synced_at ?? new Date().toISOString()
  };
  await uploadJson(googleReviewIndexPath(merchantId, input.source_review_id), record, true);
  return record;
}
