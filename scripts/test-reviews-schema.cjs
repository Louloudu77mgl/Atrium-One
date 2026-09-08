const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const merchant = { id: "merchant-test" };
const row = {
  id: "review-test", author_name: "Camille", rating: 5, review_text: "Très bon accueil.",
  status: "generated", sentiment: "positif", created_at: "2026-09-01T10:00:00Z"
};

function loadReviews(client) {
  const filename = path.join(__dirname, "../lib/reviews.ts");
  const js = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  const mocks = {
    "@/lib/merchants": { getMerchant: async () => merchant },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client }
  };
  vm.runInThisContext(`(function(require, module, exports) { ${js}\n})`, { filename })(
    (id) => { assert.ok(mocks[id], `Unexpected dependency: ${id}`); return mocks[id]; },
    mod, mod.exports
  );
  return mod.exports;
}

function setup({ legacy = false, failure = null, empty = false } = {}) {
  const queries = [];
  const client = {
    from(table) {
      const state = { table, columns: "", filters: [] };
      queries.push(state);
      const query = {
        select(columns) { state.columns = columns; return query; },
        eq(key, value) { state.filters.push([key, value]); return query; },
        in() { return query; },
        async order() {
          if (table === "generated_replies") return { data: [{
            id: "reply-test", review_id: row.id, reply_text: "Merci Camille !", generated_text: "Merci Camille !",
            status: "generated", is_edited: false, created_at: "2026-09-02T10:00:00Z"
          }], error: null };
          assert.deepEqual(state.filters, [["merchant_id", merchant.id]]);
          if (failure) return { data: null, error: failure };
          if (legacy && state.columns.split(",").includes("updated_at")) {
            return { data: null, error: { code: "42703", message: "column reviews.updated_at does not exist" } };
          }
          return { data: empty ? [] : [{ ...row, ...(!legacy && { updated_at: "2026-09-03T10:00:00Z" }) }], error: null };
        }
      };
      return query;
    }
  };
  return { ...loadReviews(client), queries };
}

test("legacy production schema renders reviews and their replies without updated_at", async () => {
  const { getReviews, queries } = setup({ legacy: true });
  const reviews = await getReviews(merchant);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].updatedAt, row.created_at);
  assert.equal(reviews[0].generatedReply, "Merci Camille !");
  assert.equal(reviews[0].replyCreatedAt, "2026-09-02T10:00:00Z");
  assert.equal(queries.filter((query) => query.table === "reviews").length, 2);
});

test("current schemas preserve updated_at without a fallback request", async () => {
  const { getReviews, queries } = setup();
  assert.equal((await getReviews(merchant))[0].updatedAt, "2026-09-03T10:00:00Z");
  assert.equal(queries.filter((query) => query.table === "reviews").length, 1);
});

test("unrelated database errors remain visible and do not trigger a schema fallback", async () => {
  const { getReviews, queries } = setup({ failure: { code: "42501", message: "permission denied" } });
  await assert.rejects(getReviews(merchant), /permission denied/);
  assert.equal(queries.length, 1);
});

test("an empty legacy account loads without fetching replies", async () => {
  const { getReviews, queries } = setup({ legacy: true, empty: true });
  assert.deepEqual(await getReviews(merchant), []);
  assert.ok(queries.every((query) => query.table === "reviews"));
});
