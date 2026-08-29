import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { associationStrength, findDuplicate, hasEffectiveModuleAccess } from "../lib/crm/logic.ts";

const sql = readFileSync(new URL("../supabase/crm-cockpit.sql", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../lib/supabase/middleware.ts", import.meta.url), "utf8");

test("scénario 1 — l’admin exact est isolé dans /crm", () => {
  assert.match(sql, /louisdacre@gmail\.com/);
  assert.match(middleware, /CRM_ADMIN_ONLY/);
  assert.match(middleware, /url\.pathname = "\/crm"/);
  assert.match(sql, /as restrictive for all to authenticated using \(not public\.is_atriumone_crm_admin\(\)\)/);
});

test("scénario 2 — un utilisateur normal ne peut pas entrer dans le CRM", () => {
  assert.match(middleware, /!isCrmAdmin && isCrmPath/);
  assert.match(middleware, /CRM_FORBIDDEN/);
});

test("scénario 3 — une nouvelle inscription est pending et désactivée", () => {
  assert.match(sql, /capture_new_atriumone_signup/);
  assert.match(sql, /initialize_atriumone_merchant_access/);
  assert.match(sql, /values \(new\.id, false, 'pending', 'site'\)/);
  assert.match(sql, /lead_source[^\n]*\)[\s\S]*'Inscription site'/);
});

test("scénario 4 — account_enabled écrase les modules", () => {
  assert.equal(hasEffectiveModuleAccess(false, true), false);
  assert.equal(hasEffectiveModuleAccess(true, true), true);
  assert.equal(hasEffectiveModuleAccess(true, false), false);
  assert.match(middleware, /ACCOUNT_DISABLED/);
  assert.match(middleware, /FEATURE_DISABLED/);
});

test("scénario 5 — le dédoublonnage respecte Place ID, domaine, téléphone, nom+adresse", () => {
  const leads = [
    { id: "place", google_place_id: "p1", website: "one.fr", phone: "0101", name: "A", address: "1 rue A" },
    { id: "domain", website: "https://www.domain.fr/contact" },
    { id: "phone", phone: "+33 6 12 34 56 78" },
    { id: "fingerprint", name: "Éclat Lille", address: "2, rue Nationale" }
  ];
  assert.equal(findDuplicate(leads, { placeId: "p1", website: "other.fr" })?.id, "place");
  assert.equal(findDuplicate(leads, { website: "https://domain.fr" })?.id, "domain");
  assert.equal(findDuplicate(leads, { phone: "+33612345678" })?.id, "phone");
  assert.equal(findDuplicate(leads, { name: "Eclat Lille", address: "2 rue Nationale" })?.id, "fingerprint");
});

test("scénario 6 — l’email exact est auto-associable, les signaux faibles restent manuels", () => {
  assert.equal(associationStrength({ leadEmail: "CONTACT@EXEMPLE.FR", accountEmail: "contact@exemple.fr" }), "exact_email");
  assert.equal(associationStrength({ leadPhone: "06 00 00 00 00", accountPhone: "+33 6 00 00 00 00" }), "phone");
  assert.match(sql, /lower\(email\) = account_email/);
});

test("scénario 7 — tâches et RDV sont indexés par date pour le calendrier", () => {
  assert.match(sql, /crm_tasks_due_idx/);
  assert.match(sql, /crm_appointments_date_idx/);
  assert.match(sql, /due_time time/);
});

test("scénario 8 — l’archive est un soft delete indépendant du compte", () => {
  assert.match(sql, /archived_at timestamptz/);
  assert.match(sql, /business_id uuid references public\.merchants\(id\) on delete set null/);
});

test("backfill — les comptes préexistants restent actifs et l’opération est idempotente", () => {
  assert.match(sql, /select m\.id, true, 'active', 'existing_backfill'/);
  assert.match(sql, /on conflict on constraint business_access_pkey do nothing/);
  assert.match(sql, /on conflict on constraint business_module_access_pkey do nothing/);
  assert.match(sql, /on conflict on constraint crm_leads_business_id_key do update/);
  assert.match(sql, /backfill_existing_merchants_to_crm/);
});
