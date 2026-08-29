import { createHash, randomBytes, randomInt, randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getDefaultRcuGameConfig,
  isRcuFormType,
  LEGACY_RCU_TYPE_MAP,
  normalizeRcuGameConfig,
  normalizeRcuVisitCode,
  slugifyRcuValue,
  type RcuFormType,
  type RcuGameResult,
  type RcuProgram
} from "@/lib/rcu";
import type { CustomerRow, Json, MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";

const RCU_BUCKET = "rcu-data";

export type RcuLeadRecord = {
  id: string;
  form_id: string;
  form_slug: string;
  form_title: string;
  merchant_id: string;
  customer_key?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  favorite_products: string | null;
  consent_sms: boolean;
  consent_email?: boolean;
  birthday?: string | null;
  promo_code: string | null;
  promo_label: string | null;
  promo_value: number | null;
  submitted_at: string;
  visit_day?: string;
  source?: "rcu" | "import";
  notes?: string | null;
  last_purchase_date?: string | null;
};

export type RcuGameRecord = {
  id: string;
  public_token: string;
  record_type: "game_play";
  merchant_id: string;
  program_id: string;
  program_slug: string;
  program_title: string;
  program_type: RcuFormType;
  customer_key: string;
  phone: string;
  first_name: string;
  last_name: string;
  visit_day: string;
  occurred_at: string;
  result: RcuGameResult;
};

export type RcuRewardRedemptionRecord = {
  id: string;
  public_token: string;
  record_type: "reward_redemption";
  merchant_id: string;
  program_id: string;
  program_title: string;
  customer_key: string;
  reward_id: string;
  reward_label: string;
  points_cost: number;
  visit_day: string;
  occurred_at: string;
};

export type RcuRaffleDrawRecord = {
  id: string;
  public_token: string;
  record_type: "raffle_draw";
  merchant_id: string;
  program_id: string;
  program_title: string;
  customer_key: string;
  raffle_month: string;
  prize_label: string;
  winner_play_id: string;
  winner_ticket: string;
  winner_name: string;
  winner_phone: string;
  total_tickets: number;
  visit_day: string;
  occurred_at: string;
};

export type RcuWalletRecord = {
  token: string;
  merchant_id: string;
  customer_key: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

type RcuJournalRecord = RcuGameRecord | RcuRewardRedemptionRecord | RcuRaffleDrawRecord;

export type RcuCustomerDetail = {
  customer: RcuCustomerRow;
  plays: RcuGameRecord[];
  redemptions: RcuRewardRedemptionRecord[];
  raffleDraws: RcuRaffleDrawRecord[];
  wallet: RcuWalletRecord | null;
};

export type RcuCustomerRow = CustomerRow & {
  opt_in_email: boolean;
  email_consent_source: "customer" | null;
};

let bucketPromise: Promise<void> | null = null;
let rcuRecordsTableAvailable: boolean | null = null;

function getFormPath(slug: string) {
  return `forms/${slug}.json`;
}

function getMerchantFormPath(merchantId: string, slug: string) {
  return `merchants/${merchantId}/forms/${slug}.json`;
}

function getGameRecordPath(record: Pick<RcuGameRecord, "merchant_id" | "program_id" | "customer_key" | "visit_day">) {
  return `merchants/${record.merchant_id}/records/${record.program_id}_${record.customer_key}_${record.visit_day}.json`;
}

function getPublicGameRecordPath(token: string) {
  return `plays/${token}.json`;
}

function getWalletPath(token: string) {
  return `wallets/${token}.json`;
}

function getCustomerWalletPath(merchantId: string, customerKey: string) {
  return `merchants/${merchantId}/wallets/${customerKey}.json`;
}

function getRaffleDrawPath(merchantId: string, programId: string, month: string) {
  return `merchants/${merchantId}/records/raffle_draw_${programId}_${month}.json`;
}

function createVisitValidationCode() {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

function withVisitValidation(program: RcuProgram): RcuProgram {
  const normalizedConfig = normalizeRcuGameConfig(program.form_type, program.game_config);
  const existingCode = normalizeRcuVisitCode(normalizedConfig.visitValidationCode);
  return {
    ...program,
    game_config: {
      ...normalizedConfig,
      visitValidationEnabled: true,
      visitValidationCode: existingCode ?? createVisitValidationCode(),
      visitValidationUpdatedAt: existingCode
        ? normalizedConfig.visitValidationUpdatedAt
        : new Date().toISOString()
    }
  };
}

export function getRcuCustomerKey(merchantId: string, phone: string, email?: string | null) {
  const normalizedEmail = normalizeRcuEmail(email);
  const identity = normalizedEmail ? `email:${normalizedEmail}` : `phone:${phone}`;
  return createHash("sha256").update(`${merchantId}:${identity}`).digest("hex").slice(0, 24);
}

function normalizeRcuEmail(email?: string | null) {
  return String(email ?? "").trim().toLocaleLowerCase("fr-FR");
}

function normalizeRcuName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]/g, "");
}

function isRcuGameRecord(value: unknown): value is RcuGameRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<RcuGameRecord>;
  return record.record_type === "game_play" && typeof record.id === "string" && typeof record.merchant_id === "string";
}

function isRcuRewardRedemptionRecord(value: unknown): value is RcuRewardRedemptionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<RcuRewardRedemptionRecord>;
  return record.record_type === "reward_redemption" && typeof record.id === "string" && typeof record.merchant_id === "string";
}

function isRcuRaffleDrawRecord(value: unknown): value is RcuRaffleDrawRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<RcuRaffleDrawRecord>;
  return record.record_type === "raffle_draw" && typeof record.id === "string" && typeof record.raffle_month === "string";
}

async function mirrorJournalRecordInDatabase(record: RcuJournalRecord) {
  if (rcuRecordsTableAvailable === false) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("rcu_records").insert({
    id: record.id,
    merchant_id: record.merchant_id,
    record_type: record.record_type,
    program_id: record.program_id,
    customer_key: record.customer_key,
    public_token: record.public_token,
    visit_day: record.visit_day,
    payload: record as unknown as Json,
    occurred_at: record.occurred_at
  });
  rcuRecordsTableAvailable = !error || error.code === "23505";
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeStoredProgram(form: (Omit<RcuProgram, "form_type" | "game_config"> & { form_type: string; game_config?: RcuProgram["game_config"] }) | null): RcuProgram | null {
  if (!form) return null;
  const formType = isRcuFormType(form.form_type) ? form.form_type : LEGACY_RCU_TYPE_MAP[form.form_type];
  if (!formType) return null;
  return {
    ...form,
    form_type: formType,
    game_config: normalizeRcuGameConfig(formType, form.game_config ?? getDefaultRcuGameConfig(formType))
  } satisfies RcuProgram;
}

async function ensureRcuBucket() {
  if (bucketPromise) {
    return bucketPromise;
  }

  bucketPromise = (async () => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.storage.getBucket(RCU_BUCKET);

    if (data) {
      return;
    }

    const { error } = await supabase.storage.createBucket(RCU_BUCKET, {
      public: false,
      fileSizeLimit: 1024 * 1024,
      allowedMimeTypes: ["application/json"]
    });

    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw new Error(`Impossible d’initialiser le stockage RCU : ${error.message}`);
    }
  })().catch((error) => {
    bucketPromise = null;
    throw error;
  });

  return bucketPromise;
}

async function downloadJson<T>(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(RCU_BUCKET).download(path);

  if (error || !data) {
    return null;
  }

  return parseJson<T>(await data.text());
}

async function uploadJson(path: string, value: unknown, upsert: boolean) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(RCU_BUCKET)
    .upload(path, Buffer.from(JSON.stringify(value)), {
      contentType: "application/json",
      cacheControl: "0",
      upsert
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createStoredRcuForm(input: Omit<RcuProgram, "id" | "created_at">) {
  await ensureRcuBucket();
  const slug = slugifyRcuValue(input.slug);

  if (!slug || slug !== input.slug) {
    throw new Error("Le lien personnalisé du RCU est invalide.");
  }

  const existingForm = normalizeStoredProgram(await downloadJson<RcuProgram>(getFormPath(slug)));

  if (existingForm && existingForm.merchant_id !== input.merchant_id) {
    throw new Error("Ce lien RCU est déjà utilisé. Choisissez un autre lien personnalisé.");
  }

  const form = withVisitValidation({
    ...input,
    id: existingForm?.id ?? randomUUID(),
    slug,
    created_at: existingForm?.created_at ?? new Date().toISOString()
  });

  await uploadJson(getFormPath(slug), form, true);

  try {
    await uploadJson(getMerchantFormPath(form.merchant_id, slug), form, true);
  } catch (error) {
    if (!existingForm) {
      const supabase = createSupabaseAdminClient();
      await supabase.storage.from(RCU_BUCKET).remove([getFormPath(slug)]);
    }
    throw error;
  }

  return form;
}

export async function updateStoredRcuVisitCode({ merchantId, slug, code }: { merchantId: string; slug: string; code?: string | null }) {
  await ensureRcuBucket();
  const stored = normalizeStoredProgram(await downloadJson<RcuProgram>(getFormPath(slug)));
  if (!stored || stored.merchant_id !== merchantId) throw new Error("RCU introuvable.");
  if (!stored.is_active) throw new Error("Activez ce RCU avant de modifier son code commerçant.");
  const normalizedCode = code ? normalizeRcuVisitCode(code) : createVisitValidationCode();
  if (!normalizedCode) throw new Error("Le code doit contenir 2 à 4 lettres ou chiffres.");
  const updated: RcuProgram = {
    ...stored,
    game_config: {
      ...stored.game_config,
      visitValidationEnabled: true,
      visitValidationCode: normalizedCode,
      visitValidationUpdatedAt: new Date().toISOString()
    }
  };
  await Promise.all([
    uploadJson(getFormPath(slug), updated, true),
    uploadJson(getMerchantFormPath(merchantId, slug), updated, true)
  ]);
  return updated;
}

export async function updateStoredRcuStatus({ merchantId, slug, isActive }: { merchantId: string; slug: string; isActive: boolean }) {
  await ensureRcuBucket();
  const stored = normalizeStoredProgram(await downloadJson<RcuProgram>(getFormPath(slug)));
  if (!stored || stored.merchant_id !== merchantId) throw new Error("RCU introuvable.");
  const updated = withVisitValidation({ ...stored, is_active: isActive });
  await Promise.all([
    uploadJson(getFormPath(slug), updated, true),
    uploadJson(getMerchantFormPath(merchantId, slug), updated, true)
  ]);

  const supabase = createSupabaseAdminClient();
  await supabase.from("rcu_forms").update({ is_active: isActive }).eq("merchant_id", merchantId).eq("slug", slug);
  return updated;
}

export async function deleteStoredRcuForm({ merchantId, slug }: { merchantId: string; slug: string }) {
  await ensureRcuBucket();
  const stored = normalizeStoredProgram(await downloadJson<RcuProgram>(getFormPath(slug)));
  if (!stored || stored.merchant_id !== merchantId) throw new Error("RCU introuvable.");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(RCU_BUCKET).remove([
    getFormPath(slug),
    getMerchantFormPath(merchantId, slug)
  ]);
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
  await supabase.from("rcu_forms").delete().eq("merchant_id", merchantId).eq("slug", slug);
}

export async function getStoredRcuForm(slugValue: string) {
  await ensureRcuBucket();
  const slug = slugifyRcuValue(slugValue);

  if (!slug || slug !== slugValue) {
    return null;
  }

  let form = normalizeStoredProgram(await downloadJson<RcuProgram>(getFormPath(slug)));
  if (!form || !form.is_active) {
    return null;
  }

  if (form.game_config.visitValidationEnabled === false || !normalizeRcuVisitCode(form.game_config.visitValidationCode)) {
    form = withVisitValidation(form);
    await Promise.all([
      uploadJson(getFormPath(slug), form, true),
      uploadJson(getMerchantFormPath(form.merchant_id, slug), form, true)
    ]);
  }

  return form;
}

export async function getRcuPublicBrand(merchantId: string): Promise<{
  merchant: MerchantRow | null;
  brandSettings: MerchantBrandSettingsRow | null;
}> {
  const supabase = createSupabaseAdminClient();
  const [merchantResult, brandResult] = await Promise.all([
    supabase.from("merchants").select("*").eq("id", merchantId).maybeSingle(),
    supabase.from("merchant_brand_settings").select("*").eq("merchant_id", merchantId).maybeSingle()
  ]);

  return {
    merchant: merchantResult.data ?? null,
    brandSettings: brandResult.data ?? null
  };
}

export async function listStoredRcuForms(merchantId: string) {
  await ensureRcuBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/forms`;
  const { data, error } = await supabase.storage.from(RCU_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error) {
    throw new Error(`Impossible de charger les RCU : ${error.message}`);
  }

  const forms = await Promise.all(
    (data ?? [])
      .filter((item) => item.name.endsWith(".json"))
      .map((item) => downloadJson<RcuProgram>(`${prefix}/${item.name}`))
  );

  const normalizedForms = forms
    .map((form) => normalizeStoredProgram(form))
    .filter((form) => Boolean(form && form.merchant_id === merchantId))
    .map((form) => form as RcuProgram)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  return Promise.all(normalizedForms.map(async (form) => {
    if (form.game_config.visitValidationEnabled !== false && normalizeRcuVisitCode(form.game_config.visitValidationCode)) return form;
    const migrated = withVisitValidation(form);
    await Promise.all([
      uploadJson(getFormPath(form.slug), migrated, true),
      uploadJson(getMerchantFormPath(merchantId, form.slug), migrated, true)
    ]);
    return migrated;
  }));
}

export async function listStoredRcuGameRecords(merchantId: string, filters?: { customerKey?: string; programId?: string }) {
  await ensureRcuBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/records`;
  const { data, error } = await supabase.storage.from(RCU_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error) {
    throw new Error(`Impossible de charger l’historique RCU : ${error.message}`);
  }

  const records = await Promise.all(
    (data ?? [])
      .filter((item) => item.name.endsWith(".json"))
      .map((item) => downloadJson<RcuGameRecord>(`${prefix}/${item.name}`))
  );

  let databaseResult: { data: Array<{ payload: Json }> | null; error: { message: string } | null } = { data: null, error: null };
  if (rcuRecordsTableAvailable !== false) {
    let databaseQuery = supabase
      .from("rcu_records")
      .select("payload")
      .eq("merchant_id", merchantId)
      .eq("record_type", "game_play")
      .order("occurred_at", { ascending: false })
      .limit(1000);
    if (filters?.customerKey) databaseQuery = databaseQuery.eq("customer_key", filters.customerKey);
    if (filters?.programId) databaseQuery = databaseQuery.eq("program_id", filters.programId);
    databaseResult = await databaseQuery;
    rcuRecordsTableAvailable = !databaseResult.error;
  }
  const databaseRecords = databaseResult.error
    ? []
    : (databaseResult.data ?? []).map((row) => row.payload).filter(isRcuGameRecord);
  const merged = new Map<string, RcuGameRecord>();

  [...records.filter(isRcuGameRecord), ...databaseRecords]
    .filter((record): record is RcuGameRecord => Boolean(
      record &&
      record.record_type === "game_play" &&
      record.merchant_id === merchantId &&
      (!filters?.customerKey || record.customer_key === filters.customerKey) &&
      (!filters?.programId || record.program_id === filters.programId)
    ))
    .forEach((record) => merged.set(record.id, record));

  return Array.from(merged.values()).sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
}

export async function getStoredRcuGameRecordForDay({
  merchantId,
  programId,
  customerKey,
  visitDay
}: {
  merchantId: string;
  programId: string;
  customerKey: string;
  visitDay: string;
}) {
  await ensureRcuBucket();
  const storedRecord = await downloadJson<RcuGameRecord>(getGameRecordPath({
    merchant_id: merchantId,
    program_id: programId,
    customer_key: customerKey,
    visit_day: visitDay
  }));
  if (storedRecord) return storedRecord;
  if (rcuRecordsTableAvailable === false) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("rcu_records")
    .select("payload")
    .eq("merchant_id", merchantId)
    .eq("record_type", "game_play")
    .eq("program_id", programId)
    .eq("customer_key", customerKey)
    .eq("visit_day", visitDay)
    .maybeSingle();
  rcuRecordsTableAvailable = !error;
  return isRcuGameRecord(data?.payload) ? data.payload : null;
}

export async function saveStoredRcuGameRecord(record: RcuGameRecord) {
  await ensureRcuBucket();
  const path = getGameRecordPath(record);
  const existing = await downloadJson<RcuGameRecord>(path);
  if (existing) {
    await mirrorJournalRecordInDatabase(existing);
    return existing;
  }

  try {
    await uploadJson(path, record, false);
    await uploadJson(getPublicGameRecordPath(record.public_token), record, false);
    await mirrorJournalRecordInDatabase(record);
    return record;
  } catch (error) {
    const racedRecord = await downloadJson<RcuGameRecord>(path);
    if (racedRecord) return racedRecord;
    throw error;
  }
}

export async function getStoredRcuGameRecordByToken(token: string) {
  if (!/^[a-f0-9]{32}$/i.test(token)) return null;
  await ensureRcuBucket();
  const storedRecord = await downloadJson<RcuGameRecord>(getPublicGameRecordPath(token));
  if (storedRecord) return storedRecord;
  if (rcuRecordsTableAvailable === false) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("rcu_records").select("payload").eq("public_token", token).maybeSingle();
  rcuRecordsTableAvailable = !error;
  return isRcuGameRecord(data?.payload) ? data.payload : null;
}

export async function listStoredRcuRewardRedemptions(merchantId: string, filters?: { customerKey?: string; programId?: string }) {
  await ensureRcuBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/records`;
  const { data, error } = await supabase.storage.from(RCU_BUCKET).list(prefix, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(`Impossible de charger les récompenses utilisées : ${error.message}`);
  const stored = await Promise.all((data ?? []).filter((item) => item.name.startsWith("redemption_") && item.name.endsWith(".json")).map((item) => downloadJson<RcuRewardRedemptionRecord>(`${prefix}/${item.name}`)));

  let databaseRecords: RcuRewardRedemptionRecord[] = [];
  if (rcuRecordsTableAvailable !== false) {
    let query = supabase.from("rcu_records").select("payload").eq("merchant_id", merchantId).eq("record_type", "reward_redemption").order("occurred_at", { ascending: false }).limit(1000);
    if (filters?.customerKey) query = query.eq("customer_key", filters.customerKey);
    if (filters?.programId) query = query.eq("program_id", filters.programId);
    const result = await query;
    rcuRecordsTableAvailable = !result.error;
    databaseRecords = result.error ? [] : (result.data ?? []).map((row) => row.payload).filter(isRcuRewardRedemptionRecord);
  }

  const merged = new Map<string, RcuRewardRedemptionRecord>();
  [...stored.filter(isRcuRewardRedemptionRecord), ...databaseRecords]
    .filter((record) => (!filters?.customerKey || record.customer_key === filters.customerKey) && (!filters?.programId || record.program_id === filters.programId))
    .forEach((record) => merged.set(record.id, record));
  return Array.from(merged.values()).sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
}

export async function saveStoredRcuRewardRedemption(record: RcuRewardRedemptionRecord) {
  await ensureRcuBucket();
  await uploadJson(`merchants/${record.merchant_id}/records/redemption_${record.occurred_at.replace(/[:.]/g, "-")}_${record.id}.json`, record, false);
  await mirrorJournalRecordInDatabase(record);
  return record;
}

export async function listStoredRcuRaffleDraws(merchantId: string, filters?: { customerKey?: string; programId?: string; month?: string }) {
  await ensureRcuBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/records`;
  const { data, error } = await supabase.storage.from(RCU_BUCKET).list(prefix, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(`Impossible de charger les tirages : ${error.message}`);
  const stored = await Promise.all((data ?? [])
    .filter((item) => item.name.startsWith("raffle_draw_") && item.name.endsWith(".json"))
    .map((item) => downloadJson<RcuRaffleDrawRecord>(`${prefix}/${item.name}`)));

  let databaseRecords: RcuRaffleDrawRecord[] = [];
  if (rcuRecordsTableAvailable !== false) {
    let query = supabase.from("rcu_records").select("payload").eq("merchant_id", merchantId).eq("record_type", "raffle_draw").order("occurred_at", { ascending: false }).limit(1000);
    if (filters?.customerKey) query = query.eq("customer_key", filters.customerKey);
    if (filters?.programId) query = query.eq("program_id", filters.programId);
    const result = await query;
    rcuRecordsTableAvailable = !result.error;
    databaseRecords = result.error ? [] : (result.data ?? []).map((row) => row.payload).filter(isRcuRaffleDrawRecord);
  }

  const merged = new Map<string, RcuRaffleDrawRecord>();
  [...stored.filter(isRcuRaffleDrawRecord), ...databaseRecords]
    .filter((record) => record.merchant_id === merchantId
      && (!filters?.customerKey || record.customer_key === filters.customerKey)
      && (!filters?.programId || record.program_id === filters.programId)
      && (!filters?.month || record.raffle_month === filters.month))
    .forEach((record) => merged.set(record.id, record));
  return Array.from(merged.values()).sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
}

export async function saveStoredRcuRaffleDraw(record: RcuRaffleDrawRecord) {
  await ensureRcuBucket();
  const path = getRaffleDrawPath(record.merchant_id, record.program_id, record.raffle_month);
  const existing = await downloadJson<RcuRaffleDrawRecord>(path);
  if (existing) return existing;
  try {
    await uploadJson(path, record, false);
    await mirrorJournalRecordInDatabase(record);
    return record;
  } catch (error) {
    const racedRecord = await downloadJson<RcuRaffleDrawRecord>(path);
    if (racedRecord) return racedRecord;
    throw error;
  }
}

export async function getOrCreateStoredRcuWallet({ merchantId, customerKey, firstName, lastName, phone, email }: { merchantId: string; customerKey: string; firstName: string; lastName: string; phone: string; email?: string | null }) {
  await ensureRcuBucket();
  const current = await downloadJson<RcuWalletRecord>(getCustomerWalletPath(merchantId, customerKey));
  const now = new Date().toISOString();
  const wallet: RcuWalletRecord = {
    token: current?.token ?? randomBytes(24).toString("hex"),
    merchant_id: merchantId,
    customer_key: customerKey,
    first_name: firstName || current?.first_name || "Client",
    last_name: lastName || current?.last_name || "",
    phone,
    email: email || current?.email || null,
    created_at: current?.created_at ?? now,
    updated_at: now
  };
  await Promise.all([
    uploadJson(getCustomerWalletPath(merchantId, customerKey), wallet, true),
    uploadJson(getWalletPath(wallet.token), wallet, true)
  ]);
  return wallet;
}

export async function getStoredRcuWalletByToken(token: string) {
  if (!/^[a-f0-9]{48}$/i.test(token)) return null;
  await ensureRcuBucket();
  return downloadJson<RcuWalletRecord>(getWalletPath(token));
}

export async function getStoredRcuWalletForCustomer(merchantId: string, customerKey: string) {
  await ensureRcuBucket();
  return downloadJson<RcuWalletRecord>(getCustomerWalletPath(merchantId, customerKey));
}

export async function saveStoredRcuLead(lead: RcuLeadRecord) {
  await ensureRcuBucket();
  const idempotentName = lead.source === "rcu" && lead.customer_key && lead.visit_day
    ? `${lead.form_id}_${lead.customer_key}_${lead.visit_day}.json`
    : `${lead.submitted_at.replace(/[:.]/g, "-")}-${lead.id}.json`;
  const path = `merchants/${lead.merchant_id}/leads/${idempotentName}`;
  await uploadJson(path, lead, Boolean(lead.source === "rcu" && lead.customer_key && lead.visit_day));
  return lead;
}

export async function listStoredRcuLeads(merchantId: string): Promise<RcuLeadRecord[]> {
  await ensureRcuBucket();
  const supabase = createSupabaseAdminClient();
  const prefix = `merchants/${merchantId}/leads`;
  const { data, error } = await supabase.storage.from(RCU_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error) {
    throw new Error(`Impossible de charger les contacts RCU : ${error.message}`);
  }

  const records = await Promise.all(
    (data ?? [])
      .filter((item) => item.name.endsWith(".json"))
      .map((item) => downloadJson<RcuLeadRecord>(`${prefix}/${item.name}`))
  );
  return records
    .filter((lead): lead is RcuLeadRecord => Boolean(lead && lead.merchant_id === merchantId))
    .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at));
}

function buildStoredRcuCustomers(
  merchantId: string,
  records: RcuLeadRecord[]
): RcuCustomerRow[] {
  const latestByIdentity = new Map<string, RcuLeadRecord>();

  records.forEach((lead) => {
    const customerKey = getRcuCustomerKey(merchantId, lead.phone, lead.email);
    if (!latestByIdentity.has(customerKey)) latestByIdentity.set(customerKey, lead);
  });

  return Array.from(latestByIdentity.entries()).map(([customerKey, lead]) => {
    const customerConsent = lead.consent_email === true;

    return {
      id: customerKey,
      merchant_id: lead.merchant_id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      gender_guess: null,
      opt_in_sms: lead.consent_sms,
      opt_in_email: customerConsent,
      email_consent_source: customerConsent ? "customer" : null,
      sms_unsubscribed: false,
      favorite_products: lead.favorite_products ? [lead.favorite_products] : [],
      last_purchase_date: lead.last_purchase_date ?? null,
      notes: `${lead.form_title}${lead.notes ? ` · ${lead.notes}` : ""}${lead.promo_code ? ` · Code ${lead.promo_code}` : ""}`,
      created_at: lead.submitted_at,
      updated_at: lead.submitted_at
    };
  });
}

export async function listStoredRcuCustomers(merchantId: string): Promise<RcuCustomerRow[]> {
  const records = await listStoredRcuLeads(merchantId);
  return buildStoredRcuCustomers(merchantId, records);
}

export async function getStoredRcuCustomerDetail(merchantId: string, customerKey: string): Promise<RcuCustomerDetail | null> {
  const [leads, allPlays, allRedemptions, allRaffleDraws, directWallet] = await Promise.all([
    listStoredRcuLeads(merchantId),
    listStoredRcuGameRecords(merchantId),
    listStoredRcuRewardRedemptions(merchantId),
    listStoredRcuRaffleDraws(merchantId),
    getStoredRcuWalletForCustomer(merchantId, customerKey)
  ]);
  const customers = buildStoredRcuCustomers(merchantId, leads);
  const customer = customers.find((item) => item.id === customerKey);
  if (!customer) return null;

  const customerLeads = leads.filter((lead) => getRcuCustomerKey(merchantId, lead.phone, lead.email) === customerKey);
  const legacyKeys = new Set(customerLeads.map((lead) => lead.customer_key).filter((key): key is string => Boolean(key)));
  const identitiesByLegacyKey = new Map<string, Set<string>>();
  leads.forEach((lead) => {
    if (!lead.customer_key) return;
    const identities = identitiesByLegacyKey.get(lead.customer_key) ?? new Set<string>();
    identities.add(getRcuCustomerKey(merchantId, lead.phone, lead.email));
    identitiesByLegacyKey.set(lead.customer_key, identities);
  });
  const targetName = normalizeRcuName(customer.first_name, customer.last_name);
  const isUnambiguousLegacyKey = (key: string) => identitiesByLegacyKey.get(key)?.size === 1;
  const matchesLegacyIdentity = (key: string, firstName: string, lastName: string) => legacyKeys.has(key)
    && (isUnambiguousLegacyKey(key) || normalizeRcuName(firstName, lastName) === targetName);
  const plays = allPlays.filter((record) => record.customer_key === customerKey || matchesLegacyIdentity(record.customer_key, record.first_name, record.last_name));
  const redemptions = allRedemptions.filter((record) => record.customer_key === customerKey || (legacyKeys.has(record.customer_key) && isUnambiguousLegacyKey(record.customer_key)));
  const raffleDraws = allRaffleDraws.filter((record) => record.customer_key === customerKey || matchesLegacyIdentity(record.customer_key, record.winner_name, ""));
  let wallet = directWallet;
  if (!wallet) {
    for (const legacyKey of legacyKeys) {
      const legacyWallet = await getStoredRcuWalletForCustomer(merchantId, legacyKey);
      const walletMatchesEmail = normalizeRcuEmail(legacyWallet?.email) === normalizeRcuEmail(customer.email);
      const walletMatchesName = legacyWallet ? normalizeRcuName(legacyWallet.first_name, legacyWallet.last_name) === targetName : false;
      if (legacyWallet && (walletMatchesEmail || walletMatchesName)) {
        wallet = legacyWallet;
        break;
      }
    }
  }
  return { customer, plays, redemptions, raffleDraws, wallet };
}
