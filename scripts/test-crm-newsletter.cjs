const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./emailing-test-loader.cjs");
const draft = { title: "Les nouvelles AtriumOne", summary: "Un rendez-vous avec notre équipe", description: "Bonjour,\n\nMerci de votre confiance.\nL’équipe AtriumOne", emailSubject: "Votre newsletter AtriumOne", emailIntro: "Découvrez nos nouvelles." };

test("generation API allows only the actual CRM administrator and never saves or sends", async () => {
  let user = null, calls = 0;
  const mocks = {
    "@/lib/supabase/server": { getCurrentUser: async () => user },
    "@/lib/merchants": {}, "@/lib/supabase/admin": {},
    "@/lib/crm/newsletter-generation": { generateCrmNewsletter: async () => { calls++; return draft; } }
  };
  const { POST } = load("app/api/crm/releases/generate/route.ts", mocks);
  const request = (prompt = "Prépare une newsletter pour nos utilisateurs") => new Request("https://example.com/api/crm/releases/generate", { method: "POST", body: JSON.stringify({ prompt, email: "louisdacre@gmail.com" }) });
  for (const email of [null, "client@example.com", "louisdacre@gmail.com.attacker.test"]) {
    user = email ? { email } : null;
    assert.equal((await POST(request())).status, 403);
  }
  assert.equal(calls, 0);
  user = { email: "louisdacre@gmail.com" };
  for (const input of ["", "court", "x".repeat(6001), null]) assert.equal((await POST(request(input))).status, 400);
  assert.equal(calls, 0);
  const response = await POST(request());
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).draft, draft); assert.equal(calls, 1);
});

test("AI output is validated and failures produce no replacement draft", async () => {
  const oldFetch = global.fetch, oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  const { generateCrmNewsletter, parseNewsletterDraft } = load("lib/crm/newsletter-generation.ts");
  try {
    assert.throws(() => parseNewsletterDraft({ ...draft, description: "" }));
    assert.throws(() => parseNewsletterDraft({ ...draft, emailSubject: "x".repeat(181) }));
    global.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.store, false); assert.equal(body.text.format.type, "json_schema");
      assert.match(body.instructions, /AtriumOne à ses utilisateurs/);
      return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(draft) }] }] });
    };
    assert.deepEqual(await generateCrmNewsletter("Notre actualité"), draft);
    for (const response of [Response.json({}, { status: 429 }), Response.json({ status: "incomplete" }), Response.json({ status: "completed", output: [] })]) {
      global.fetch = async () => response;
      await assert.rejects(generateCrmNewsletter("Notre actualité"));
    }
  } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});

test("newsletter uses the existing sanitized CRM preview/send renderer", () => {
  const { renderAtriumOneReleaseEmail } = load("lib/crm/release-email.ts");
  const release = { title: draft.title, summary: draft.summary, description: "Bonjour <script>alert(1)</script>\nBonne lecture", email_subject: draft.emailSubject, email_intro: draft.emailIntro, category: "Newsletter", release_date: "2026-10-07", highlights: [], improvements: [], fixes: [] };
  const html = renderAtriumOneReleaseEmail({ release, origin: "https://app.atrium-one.fr" });
  assert.match(html, /Newsletter AtriumOne/); assert.match(html, /Bonne lecture/); assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Découvrir AtriumOne/);
});
