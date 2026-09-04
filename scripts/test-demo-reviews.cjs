const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

// Run the actual TypeScript handlers with an in-memory database boundary.
// No credentials, network requests or live records are used by these tests.
function load(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  const js = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  const localRequire = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/")) return load(id.slice(2) + ".ts", mocks);
    throw new Error("Unmocked dependency: " + id);
  };
  vm.runInThisContext(`(function(require, module, exports) { ${js}\n})`, { filename })(localRequire, mod, mod.exports);
  return mod.exports;
}

const demoId = "dfe516ad-4c27-497b-afb2-4e836cdd3fcf";
const reviewId = "77777777-7777-4777-8777-777777777777";
const otherId = "88888888-8888-4888-8888-888888888888";
const validReview = { author_name: " Camille ", rating: 5, review_text: " Très bon pain. " };

function setup(options = {}) {
  const state = { rows: options.rows ?? [], queries: 0, refreshed: [], invalidated: [] };
  const merchant = options.merchant === undefined ? { id: demoId, business_name: "Boulangerie Oulah" } : options.merchant;
  const supabase = {
    auth: { getUser: async () => ({ data: { user: options.loggedOut ? null : { id: "owner", email: "demo@example.test" } } }) },
    from(table) {
      assert.equal(table, "reviews");
      state.queries++;
      let operation = "select", values, filters = [];
      const execute = () => {
        if (options.dbError) return { data: null, error: new Error("Database unavailable") };
        const matches = (row) => filters.every(([key, value]) => row[key] === value);
        if (operation === "insert") {
          const row = { id: reviewId, created_at: "2026-09-04T12:00:00Z", ...values };
          state.rows.push(row);
          return { data: row, error: null };
        }
        if (operation === "delete") {
          const row = state.rows.find(matches);
          state.rows = state.rows.filter((item) => !matches(item));
          return { data: row ? { id: row.id } : null, error: null };
        }
        return { data: state.rows.filter(matches), error: null };
      };
      const query = {
        insert(input) { operation = "insert"; values = input; return query; },
        delete() { operation = "delete"; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        select() { return query; },
        order() { return Promise.resolve(execute()); },
        single() { return Promise.resolve(execute()); },
        maybeSingle() { return Promise.resolve(execute()); }
      };
      return query;
    }
  };
  const mocks = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "next/cache": { revalidatePath: (url) => state.invalidated.push(url) },
    "@/lib/admin": { isAdminEmail: () => Boolean(options.admin) },
    "@/lib/merchants": { getMerchant: async () => merchant },
    "@/lib/supabase/env": { hasSupabaseEnv: () => true },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => supabase },
    "@/lib/refresh-review-insights": { refreshReviewInsightsForMerchant: async ({ reviews }) => {
      if (options.insightsError) throw new Error("Analysis unavailable");
      state.refreshed.push(reviews);
    } }
  };
  const handlers = load("app/api/admin/reviews/route.ts", mocks);
  async function request(method, data, raw = false) {
    return handlers[method](new Request("http://localhost/api/admin/reviews", {
      method, headers: { "Content-Type": "application/json" }, body: raw ? data : JSON.stringify(data)
    }));
  }
  return { state, request };
}

test("only the stable Oulah account ID enables demo controls", () => {
  const { isDemoMerchant } = load("lib/demo-merchant.ts");
  assert.equal(isDemoMerchant({ id: demoId, business_name: "New name" }), true);
  assert.equal(isDemoMerchant({ id: otherId, business_name: "Boulangerie Oulah" }), false);
  assert.equal(isDemoMerchant(null), false);
});

test("anonymous users and non-demo merchants cannot mutate demo reviews", async () => {
  for (const method of ["POST", "DELETE"]) {
    for (const [options, status] of [[{ loggedOut: true }, 401], [{ merchant: null }, 404], [{ merchant: { id: otherId, business_name: "Boulangerie Oulah" } }, 403]]) {
      const { request, state } = setup(options);
      assert.equal((await request(method, method === "POST" ? validReview : { review_id: reviewId })).status, status);
      assert.equal(state.queries, 0);
    }
  }
});

test("invalid JSON, field types, lengths and ratings are rejected before any write", async () => {
  const { request, state } = setup();
  for (const data of [null, [], {}, { ...validReview, author_name: 1 }, { ...validReview, author_name: " " }, { ...validReview, author_name: "a".repeat(121) }, { ...validReview, review_text: "a".repeat(5001) }, ...[0, 6, 2.5, "5", true].map((rating) => ({ ...validReview, rating }))]) {
    assert.equal((await request("POST", data)).status, 400);
  }
  assert.equal((await request("POST", "{", true)).status, 400);
  assert.equal((await request("DELETE", { review_id: "bad-id" })).status, 400);
  assert.equal((await request("DELETE", "{", true)).status, 400);
  assert.equal(state.queries, 0);
});

test("created reviews persist under the signed-in merchant and update counters/insights", async () => {
  const { request, state } = setup();
  const response = await request("POST", { ...validReview, merchant_id: otherId, source: "google" });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.review.author, "Camille");
  assert.equal(body.review.text, "Très bon pain.");
  assert.equal(state.rows[0].merchant_id, demoId);
  assert.equal(state.rows[0].source, "manual");
  assert.equal(state.rows[0].source_review_id, null);
  assert.equal(state.refreshed[0].length, 1);
  assert.equal(load("lib/review-counters.ts").getReviewCountersFromReviews([body.review]).total, 1);
  assert.equal(load("lib/hans-score.ts").getHansScore([body.review]).averageRating, 5);
});

test("deletion cannot remove another merchant's record", async () => {
  const { request, state } = setup({ rows: [{ id: reviewId, merchant_id: otherId }] });
  assert.equal((await request("DELETE", { review_id: reviewId, merchant_id: otherId })).status, 404);
  assert.equal(state.rows.length, 1);
  assert.equal(state.refreshed.length, 0);
});

test("deleting the last review clears derived data and a repeated delete returns 404", async () => {
  const { request, state } = setup({ rows: [{ id: reviewId, merchant_id: demoId }] });
  const response = await request("DELETE", { review_id: reviewId });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deletedReviewId, reviewId);
  assert.equal(state.rows.length, 0);
  assert.equal(state.refreshed[0].length, 0);
  assert.ok(state.invalidated.includes("/dashboard"));
  assert.equal(load("lib/review-counters.ts").getReviewCountersFromReviews([]).total, 0);
  assert.equal(load("lib/hans-score.ts").getHansScore([]).averageRating, 0);
  assert.equal((await request("DELETE", { review_id: reviewId })).status, 404);
});

test("database failure reports failure; analysis failure preserves successful mutation", async () => {
  for (const method of ["POST", "DELETE"]) {
    const input = method === "POST" ? validReview : { review_id: reviewId };
    const failed = setup({ dbError: true, rows: [{ id: reviewId, merchant_id: demoId }] });
    assert.equal((await failed.request(method, input)).status, 500);
    const degraded = setup({ insightsError: true, rows: method === "DELETE" ? [{ id: reviewId, merchant_id: demoId }] : [] });
    const response = await degraded.request(method, input);
    assert.equal(response.status, method === "POST" ? 201 : 200);
    assert.equal((await response.json()).insightsUpdated, false);
    assert.equal(degraded.state.rows.length, method === "POST" ? 1 : 0);
  }
});

test("existing admins retain test creation but cannot delete outside the demo account", async () => {
  const { request } = setup({ admin: true, merchant: { id: otherId } });
  assert.equal((await request("POST", validReview)).status, 201);
  assert.equal((await request("DELETE", { review_id: reviewId })).status, 403);
});
