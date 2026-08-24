import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { after } from "next/server";
import { runAutomationEvent, type AutomationEvent } from "@/lib/automation-event-runner";
import { playRcuGame } from "@/lib/rcu-game-server";
import { getRcuVisitDay } from "@/lib/rcu-game-server";
import { getOrCreateStoredRcuWallet, getRcuCustomerKey, listStoredRcuGameRecords, listStoredRcuLeads, saveStoredRcuLead } from "@/lib/rcu-store";
import { normalizeFrenchPhone } from "@/lib/sms";
import type { RcuProgram } from "@/lib/rcu";
import { normalizeRcuVisitCode } from "@/lib/rcu";

export type RcuLeadPayload = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  favorite_products?: string;
  consent_sms?: boolean;
  consent_email?: boolean;
  birthday?: string;
  privacy_consent?: boolean;
  review_confirmed?: boolean;
  visit_code?: string;
  validation_key?: string;
};

type VisitCodeAttempt = { failures: number; firstFailureAt: number; blockedUntil: number };
const visitCodeAttempts = new Map<string, VisitCodeAttempt>();
const VISIT_CODE_WINDOW_MS = 10 * 60 * 1000;
const VISIT_CODE_BLOCK_MS = 15 * 60 * 1000;
const VISIT_CODE_MAX_FAILURES = 5;

export function getRcuValidationKey(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headers.get("x-real-ip") || "unknown";
  const agent = headers.get("user-agent")?.slice(0, 120) || "unknown";
  return `${address}:${agent}`;
}

function validateVisitCode(form: RcuProgram, submittedCode: string | undefined, validationKey: string | undefined) {
  if (form.game_config.visitValidationEnabled === false) return;
  const expected = normalizeRcuVisitCode(form.game_config.visitValidationCode);
  if (!expected) return;
  const attemptKey = `${form.id}:${validationKey || "unknown"}`;
  const now = Date.now();
  const previousAttempt = visitCodeAttempts.get(attemptKey);
  if (previousAttempt?.blockedUntil && previousAttempt.blockedUntil > now) {
    throw new Error("Trop de tentatives. Réessayez dans quelques minutes ou demandez au commerçant de régénérer le code.");
  }
  const submitted = normalizeRcuVisitCode(submittedCode);
  if (!submitted || submitted.length !== expected.length || !timingSafeEqual(Buffer.from(submitted), Buffer.from(expected))) {
    const activeAttempt = previousAttempt && now - previousAttempt.firstFailureAt <= VISIT_CODE_WINDOW_MS
      ? previousAttempt
      : { failures: 0, firstFailureAt: now, blockedUntil: 0 };
    activeAttempt.failures += 1;
    if (activeAttempt.failures >= VISIT_CODE_MAX_FAILURES) activeAttempt.blockedUntil = now + VISIT_CODE_BLOCK_MS;
    visitCodeAttempts.set(attemptKey, activeAttempt);
    throw new Error("Code de visite incorrect. Demandez le code du jour à l’équipe.");
  }
  visitCodeAttempts.delete(attemptKey);
}

export function createRcuPromoCode(prefix?: string | null) {
  const safePrefix = (prefix ?? "ATRIUM")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8) || "ATRIUM";
  const suffix = randomBytes(4).toString("hex").slice(0, 8).toUpperCase();
  return `${safePrefix}-${suffix}`;
}

export async function submitRcuLead({
  form,
  payload
}: {
  form: RcuProgram;
  payload: RcuLeadPayload;
}) {
  const firstName = String(payload.first_name ?? "").trim();
  const lastName = String(payload.last_name ?? "").trim();
  const phone = normalizeFrenchPhone(payload.phone);
  const consentSms = payload.consent_sms === true;
  const consentEmail = payload.consent_email === true;
  const privacyConsent = payload.privacy_consent === true;

  if (!firstName || !phone || !privacyConsent) {
    throw new Error("Prénom, téléphone valide et accord de participation obligatoires.");
  }
  validateVisitCode(form, payload.visit_code, payload.validation_key);

  const promoCode = createRcuPromoCode(form.promo_prefix);
  const favoriteProducts = String(payload.favorite_products ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const birthday = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.birthday ?? "")) ? String(payload.birthday) : null;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Vérifiez l’adresse e-mail saisie.");
  }
  if (consentEmail && !email) {
    throw new Error("Ajoutez une adresse e-mail pour accepter les offres par e-mail.");
  }
  const customerKey = getRcuCustomerKey(form.merchant_id, phone, email);
  const submittedAt = new Date().toISOString();
  const existingLeads = await listStoredRcuLeads(form.merchant_id);
  const isNewCustomer = !existingLeads.some((lead) => getRcuCustomerKey(form.merchant_id, lead.phone, lead.email) === customerKey);
  const leadId = randomUUID();
  const leadPromise = saveStoredRcuLead({
    id: leadId,
    form_id: form.id,
    form_slug: form.slug,
    form_title: form.title,
    merchant_id: form.merchant_id,
    customer_key: customerKey,
    first_name: firstName,
    last_name: lastName,
    phone,
    email: email || null,
    favorite_products: favoriteProducts || null,
    consent_sms: consentSms,
    consent_email: consentEmail,
    birthday,
    promo_code: form.discount_label ? promoCode : null,
    promo_label: form.discount_label,
    promo_value: form.discount_value,
    submitted_at: submittedAt,
    visit_day: getRcuVisitDay(new Date(submittedAt)),
    source: "rcu",
    notes: null,
    last_purchase_date: null
  });

  const walletPromise = getOrCreateStoredRcuWallet({
    merchantId: form.merchant_id,
    customerKey,
    firstName,
    lastName,
    phone,
    email: email || null
  });

  const [wallet] = await Promise.all([walletPromise, leadPromise]);

  const game = await playRcuGame({
    form,
    customerKey,
    phone,
    firstName,
    lastName,
    reviewConfirmed: payload.review_confirmed === true
  });

  if (!game.duplicate) {
    after(async () => {
      try {
        const customerGames = await listStoredRcuGameRecords(form.merchant_id, { customerKey });
        const rewards = customerGames.reduce((total, record) => total
          + (record.result.unlockedRewards?.length ?? 0)
          + (record.result.rewardUnlocked ? 1 : 0)
          + (record.result.wheelPrize && !/rien|retentez|rejouez/i.test(record.result.wheelPrize) ? 1 : 0), 0);
        const customer: AutomationEvent["customer"] = {
          id: customerKey,
          firstName,
          lastName,
          email: email || null,
          phone,
          consentEmail,
          consentSms,
          source: "RCU",
          rewards
        };
        const events: AutomationEvent[] = [
          ...(isNewCustomer ? [{ merchantId: form.merchant_id, id: `${leadId}:new_customer`, type: "new_customer" as const, occurredAt: submittedAt, customer }] : []),
          { merchantId: form.merchant_id, id: `${game.record.id}:new_visit`, type: "new_visit", occurredAt: game.record.occurred_at, customer, details: { program: form.title } }
        ];
        const rewardUnlocked = Boolean(game.record.result.rewardUnlocked || game.record.result.unlockedRewards?.length || (game.record.result.wheelPrize && !/rien|retentez|rejouez/i.test(game.record.result.wheelPrize)));
        if (rewardUnlocked) events.push({ merchantId: form.merchant_id, id: `${game.record.id}:new_reward`, type: "new_reward", occurredAt: game.record.occurred_at, customer, details: { rewards } });
        await Promise.all(events.map((event) => runAutomationEvent(event)));
      } catch (error) {
        console.error("[rcu/automation] event_failed", { merchantId: form.merchant_id, customerKey, message: error instanceof Error ? error.message : "Erreur inconnue" });
      }
    });
  }

  return {
    promoCode: form.discount_label ? promoCode : null,
    successMessage: game.duplicate
      ? "Votre participation du jour était déjà enregistrée."
      : form.success_message?.trim() || "Merci, vos informations ont bien été enregistrées.",
    playToken: game.record.public_token,
    walletToken: wallet.token,
    duplicate: game.duplicate,
    result: game.record.result
  };
}
