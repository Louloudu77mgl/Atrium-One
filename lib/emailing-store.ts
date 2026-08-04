import { createHash, randomBytes, randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EmailCampaignRecord, EmailCampaignRecipient } from "@/lib/emailing-types";

const EMAIL_BUCKET = "emailing-data";
let bucketPromise: Promise<void> | null = null;

function parseJson<T>(value: string): T | null {
  try { return JSON.parse(value) as T; } catch { return null; }
}

async function ensureEmailBucket() {
  if (bucketPromise) return bucketPromise;
  bucketPromise = (async () => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.storage.getBucket(EMAIL_BUCKET);
    if (data) return;
    const { error } = await supabase.storage.createBucket(EMAIL_BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ["application/json"]
    });
    if (error && !error.message.toLowerCase().includes("already exists")) throw new Error(`Impossible d’initialiser l’e-mailing : ${error.message}`);
  })().catch((error) => { bucketPromise = null; throw error; });
  return bucketPromise;
}

async function downloadJson<T>(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(EMAIL_BUCKET).download(path);
  if (error || !data) return null;
  return parseJson<T>(await data.text());
}

async function uploadJson(path: string, value: unknown, upsert = true) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(EMAIL_BUCKET).upload(path, Buffer.from(JSON.stringify(value)), {
    contentType: "application/json",
    cacheControl: "0",
    upsert
  });
  if (error) throw new Error(error.message);
}

function merchantCampaignPath(merchantId: string, campaignId: string) {
  return `merchants/${merchantId}/campaigns/${campaignId}.json`;
}

function publicCampaignPath(campaignId: string) {
  return `campaigns/${campaignId}.json`;
}

function normalizeCampaign(record: EmailCampaignRecord) {
  const sentCount = Math.max(0, record.sent_count ?? 0);
  const openCount = Math.max(0, record.open_count ?? 0);
  const clickCount = Math.max(0, record.click_count ?? 0);
  return {
    ...record,
    sent_count: sentCount,
    open_count: openCount,
    click_count: clickCount,
    open_rate: sentCount ? Math.round((openCount / sentCount) * 1000) / 10 : 0,
    click_rate: sentCount ? Math.round((clickCount / sentCount) * 1000) / 10 : 0,
    provider_message_ids: record.provider_message_ids ?? [],
    recipients: record.recipients ?? []
  } satisfies EmailCampaignRecord;
}

export function createEmailRecipients(profiles: Array<{ id: string; email: string; firstName: string; lastName: string }>): EmailCampaignRecipient[] {
  return profiles.slice(0, 1000).map((profile) => ({
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    token: randomBytes(18).toString("hex")
  }));
}

export async function saveEmailCampaign(record: EmailCampaignRecord) {
  await ensureEmailBucket();
  const normalized = normalizeCampaign(record);
  await Promise.all([
    uploadJson(merchantCampaignPath(record.merchant_id, record.id), normalized),
    uploadJson(publicCampaignPath(record.id), normalized)
  ]);
  return normalized;
}

export async function createEmailCampaign(input: Omit<EmailCampaignRecord, "id" | "created_at" | "updated_at">) {
  const now = new Date().toISOString();
  return saveEmailCampaign({ ...input, id: randomUUID(), created_at: now, updated_at: now });
}

export async function listEmailCampaigns(merchantId: string) {
  await ensureEmailBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/campaigns`;
  const { data, error } = await supabase.storage.from(EMAIL_BUCKET).list(prefix, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(`Impossible de charger les campagnes : ${error.message}`);
  const campaigns = await Promise.all((data ?? []).filter((item) => item.name.endsWith(".json")).map((item) => downloadJson<EmailCampaignRecord>(`${prefix}/${item.name}`)));
  return campaigns.filter((item): item is EmailCampaignRecord => Boolean(item?.merchant_id === merchantId)).map(normalizeCampaign).sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function listScheduledEmailCampaigns(now = new Date()) {
  await ensureEmailBucket();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(EMAIL_BUCKET).list("campaigns", { limit: 1000 });
  if (error) throw new Error(`Impossible de charger les campagnes programmées : ${error.message}`);
  const campaigns = await Promise.all((data ?? []).filter((item) => item.name.endsWith(".json")).map((item) => downloadJson<EmailCampaignRecord>(`campaigns/${item.name}`)));
  return campaigns
    .filter((item): item is EmailCampaignRecord => Boolean(item?.status === "scheduled" && item.scheduled_at && new Date(item.scheduled_at) <= now))
    .map(normalizeCampaign)
    .sort((left, right) => (left.scheduled_at ?? "").localeCompare(right.scheduled_at ?? ""));
}

export async function getEmailCampaign(campaignId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return null;
  await ensureEmailBucket();
  const campaign = await downloadJson<EmailCampaignRecord>(publicCampaignPath(campaignId));
  return campaign ? normalizeCampaign(campaign) : null;
}

export async function updateEmailCampaign(campaignId: string, merchantId: string, update: Partial<EmailCampaignRecord>) {
  const current = await getEmailCampaign(campaignId);
  if (!current || current.merchant_id !== merchantId) throw new Error("Campagne introuvable.");
  return saveEmailCampaign({ ...current, ...update, id: current.id, merchant_id: current.merchant_id, updated_at: new Date().toISOString() });
}

export async function recordEmailEvent(campaignId: string, recipientToken: string, event: "open" | "click") {
  if (!/^[a-f0-9]{36}$/i.test(recipientToken)) return null;
  const campaign = await getEmailCampaign(campaignId);
  if (!campaign || !campaign.recipients.some((recipient) => recipient.token === recipientToken)) return null;
  const path = `merchants/${campaign.merchant_id}/events/${campaign.id}/${event}_${recipientToken}.json`;
  await ensureEmailBucket();
  const existing = await downloadJson<{ occurred_at: string }>(path);
  if (!existing) {
    await uploadJson(path, { campaign_id: campaign.id, recipient_token: recipientToken, event, occurred_at: new Date().toISOString() }, false);
    const update = event === "open" ? { open_count: campaign.open_count + 1 } : { click_count: campaign.click_count + 1 };
    return saveEmailCampaign({ ...campaign, ...update, updated_at: new Date().toISOString() });
  }
  return campaign;
}

export async function suppressEmailAddress(merchantId: string, email: string) {
  await ensureEmailBucket();
  const normalizedEmail = email.trim().toLocaleLowerCase("fr-FR");
  const hash = createHash("sha256").update(normalizedEmail).digest("hex");
  await uploadJson(`merchants/${merchantId}/suppressions/${hash}.json`, { email: normalizedEmail, unsubscribed_at: new Date().toISOString() });
}

export async function listSuppressedEmailAddresses(merchantId: string) {
  await ensureEmailBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/suppressions`;
  const { data, error } = await supabase.storage.from(EMAIL_BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Impossible de charger les désabonnements : ${error.message}`);
  const records = await Promise.all((data ?? []).filter((item) => item.name.endsWith(".json")).map((item) => downloadJson<{ email: string }>(`${prefix}/${item.name}`)));
  return new Set(records.map((record) => record?.email).filter((email): email is string => Boolean(email)));
}
