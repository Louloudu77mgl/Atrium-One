import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isValidEmail, normalizeInstagramHandle, PRE_ONBOARDING_PUBLIC_PATH } from "../lib/crm/pre-onboarding.ts";

test("le formulaire public utilise une URL non triviale", () => {
  assert.match(PRE_ONBOARDING_PUBLIC_PATH, /^\/pre-onboarding\/[0-9a-f-]{36}$/);
});

test("les identifiants Instagram sont normalisés", () => {
  assert.equal(normalizeInstagramHandle("@institutcamille"), "institutcamille");
  assert.equal(normalizeInstagramHandle("https://www.instagram.com/institutcamille/"), "institutcamille");
});

test("les adresses e-mail sont validées", () => {
  assert.equal(isValidEmail("commerce@example.fr"), true);
  assert.equal(isValidEmail("pas-un-email"), false);
});

test("la migration interdit la lecture anonyme et protège les confirmations", async () => {
  const sql = await readFile(new URL("../supabase/pre-onboarding.sql", import.meta.url), "utf8");
  assert.match(sql, /revoke all on public\.crm_pre_onboardings from anon/i);
  assert.match(sql, /is_atriumone_crm_admin\(\)/i);
  assert.match(sql, /google_business_confirmed and gmail_confirmed and instagram_professional_confirmed and global_confirmed/i);
});

test("la notification contient un lien vers la fiche CRM", async () => {
  const route = await readFile(new URL("../app/api/public/pre-onboarding/[token]/route.ts", import.meta.url), "utf8");
  assert.match(route, /\/crm\/leads\/\$\{leadId\}/);
  assert.match(route, /PRE_ONBOARDING_NOTIFICATION_EMAIL/);
  assert.match(route, /getCrmGmailConnection/);
});
