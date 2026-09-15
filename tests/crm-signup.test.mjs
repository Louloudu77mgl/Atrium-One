import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}

test("CRM uses the admin session even while a merchant session is active", async () => {
  const adminClient = { role: "crm-admin" };
  const context = load("../lib/crm/server.ts", {
    "next/server": {},
    "@/lib/supabase/server": {
      getCurrentUser: async () => ({ id: "admin", email: "admin@example.test" }),
      createSessionSupabaseClient: async () => adminClient,
      createServerSupabaseClient: async () => { throw new Error("Merchant session must not be used for CRM"); }
    },
    "@/lib/crm/access": { isCrmAdminEmail: () => true },
    "@/lib/crm/logic": {}
  });
  assert.equal((await context.getCrmContext()).supabase, adminClient);
});

function provisionHarness({ authUser = "signup-user", existing = false, forbidden = false } = {}) {
  let merchant = existing ? { id: "business" } : null;
  const writes = [];
  const lead = { id: "lead", auth_user_id: authUser, business_id: null, phone: null, website: null };
  const supabase = { from(table) {
    let update;
    const query = {
      select() { return this; }, eq() { return this; }, is() { return this; },
      update(value) { update = value; writes.push({ table, value }); return this; },
      async upsert(value, options) { writes.push({ table, value, options }); merchant = { id: "business" }; return { error: null }; },
      async maybeSingle() { return this.result(); }, async single() { return this.result(); },
      result() { return { error: null, data: table === "crm_leads" ? { ...lead, ...update } : table === "merchants" ? merchant : table === "business_access" ? { account_enabled: false, onboarding_status: "pending" } : [] }; },
      then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
    };
    return query;
  } };
  class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; } }
  const route = load("../app/api/crm/leads/[id]/provision/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/crm/server": {
      getCrmContext: async () => { if (forbidden) throw new ApiError(403, "FORBIDDEN", "Denied"); return { supabase }; },
      CrmApiError: ApiError,
      cleanText: (value, max) => typeof value === "string" ? value.trim().slice(0, max) || null : null,
      crmErrorResponse: (error) => ({ status: error.status ?? 500 })
    },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ ...supabase, auth: { admin: { getUserById: async (id) => ({ data: { user: { id } } }) } } }) }
  });
  return { writes, run: (body = {}) => route.POST({ json: async () => body }, { params: Promise.resolve({ id: "lead" }) }) };
}

test("signup provisioning rejects non-admins and prospects without a signup", async () => {
  for (const [options, status] of [[{ forbidden: true }, 403], [{ authUser: null }, 409]]) {
    const h = provisionHarness(options);
    assert.equal((await h.run()).status, status);
    assert.equal(h.writes.length, 0);
  }
});

test("incomplete commerce details do not create a placeholder business", async () => {
  const h = provisionHarness();
  assert.equal((await h.run({ businessName: "Commerce" })).status, 400);
  assert.equal(h.writes.length, 0);
});

test("preparing a signup links its own business without enabling access", async () => {
  const h = provisionHarness();
  const result = await h.run({ businessName: "Commerce", businessType: "Institut", city: "Paris" });
  assert.equal(result.status, 200);
  assert.equal(result.body.lead.business_id, "business");
  assert.equal(result.body.access.account_enabled, false);
  assert.equal(h.writes[0].value.user_id, "signup-user");
  assert.equal(h.writes[0].options.ignoreDuplicates, true);
  assert.ok(h.writes.every(({ table }) => !table.startsWith("business_")));
});

test("retry reuses an existing business without overwriting customer data", async () => {
  const h = provisionHarness({ existing: true });
  assert.equal((await h.run()).status, 200);
  assert.ok(h.writes.every(({ table }) => table !== "merchants"));
});
