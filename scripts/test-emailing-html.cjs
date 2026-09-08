const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

// Exercise real implementation and API handlers. No credentials, database writes or emails.
function load(relative, mocks = {}, cache = new Map()) {
  if (cache.has(relative)) return cache.get(relative).exports;
  const filename = path.join(root, relative);
  const js = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const mod = { exports: {} }; cache.set(relative, mod);
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename })(
    (id) => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? load(id.slice(2) + ".ts", mocks, cache) : require(id), mod, mod.exports
  );
  return mod.exports;
}
const { sanitizeEmailHtml, hasEmailHtmlContent, MAX_EMAIL_HTML_BYTES, isolatedEmailPreview } = load("lib/emailing-html.ts");
const { normalizeEmailContent, emailContentError } = load("lib/emailing-content.ts");
const { renderEmailHtml, personalizeEmailText } = load("lib/emailing-template.ts");
const { DEFAULT_EMAIL_CONTENT } = load("lib/emailing-types.ts");
const merchant = { id: "merchant-test", business_name: "La boutique", logo_url: "https://example.com/logo.png", website_url: "https://example.com", city: "Paris" };
const recipient = { id: "person", token: "recipient-token", email: "test@example.test", firstName: "Camille", lastName: "Dupont" };
const imported = '<!doctype html><html><head><meta charset="utf-8"><style>@media (max-width:600px){.offer{font-size:20px!important;color:#123456}}</style></head><body style="background:#eee"><table width="100%" cellpadding="12"><tr><td><h1 class="offer">Bonjour {{first_name}}</h1><a href="https://example.com/offer">Découvrir</a><img src="https://example.com/picture.png" alt="Produit"></td></tr></table></body></html>';
function campaign(content) { return { id: "campaign-test", merchant_id: merchant.id, content: { ...DEFAULT_EMAIL_CONTENT, ...content } }; }

test("imports a full responsive HTML email without losing tables, styles, image or links", () => {
  const clean = sanitizeEmailHtml(imported);
  for (const pattern of [/<html>/, /@media/, /font-size:20px!important/, /cellpadding="12"/, /href="https:\/\/example.com\/offer"/, /picture.png/]) assert.match(clean, pattern);
  assert.equal(hasEmailHtmlContent(clean), true);
  assert.equal(sanitizeEmailHtml(clean), clean, "sanitization must remain stable when saving and reopening");
});

test("removes scripts, handlers, obfuscated executable links, frames, forms and refresh redirects", () => {
  const clean = sanitizeEmailHtml('<script>alert(1)</script><img src="https://example.com/x" onerror="alert(1)"><a href="java&#x73;cript:alert(1)">Lien</a><iframe src="https://evil.test">x</iframe><object>bad</object><svg onload="alert(1)"></svg><form action="https://evil.test"><input name="secret"></form><meta http-equiv="refresh" content="0;url=https://evil.test"><base href="https://evil.test"><p>Bonjour</p>');
  assert.doesNotMatch(clean, /script|onerror|onload|javascript|iframe|object|svg|form|input|http-equiv|<base/i);
  assert.match(clean, /Bonjour/);
});

test("cleans dangerous CSS, CSS imports and local resource URLs while preserving safe styles", () => {
  const clean = sanitizeEmailHtml('<style>@import url("https://evil.test");p{color:red;behavior:url(x);background:url(javascript:evil);width:expression(1);font-size:18px}/*# sourceMappingURL=file:///etc/passwd */</style><p style="color:#112233;behavior:url(x);background:url(javascript:evil)">Bonjour</p><img src="/private"><img src="file:///tmp/a.png">');
  assert.doesNotMatch(clean, /@import|behavior|javascript|expression|sourceMappingURL|file:|src="\/private"/i);
  assert.match(clean, /color:#112233/);
  assert.match(clean, /font-size:18px/);
});

test("rejects empty and oversized HTML, measured in UTF-8 bytes", () => {
  assert.equal(hasEmailHtmlContent(sanitizeEmailHtml('<html><head><title>Empty</title><style>p{color:red}</style></head><body>&nbsp;</body></html>')), false);
  assert.throws(() => sanitizeEmailHtml("é".repeat(MAX_EMAIL_HTML_BYTES / 2 + 1)), /500 Ko/);
  assert.equal(emailContentError(normalizeEmailContent({ editorMode: "html", html: "<script>bad()</script>" })), "Importez ou saisissez un HTML contenant du texte ou une image.");
});

test("legacy generated designs remain editable with safe defaults and bounded design controls", () => {
  const content = normalizeEmailContent(DEFAULT_EMAIL_CONTENT);
  assert.equal(content.editorMode, "visual");
  assert.equal(content.design.width, 640);
  assert.equal(emailContentError(content), null);
  const unsafe = normalizeEmailContent({ design: { width: 99999, padding: -9, headingSize: Infinity, font: "<script>", textColor: "red;display:none", alignment: "evil" } });
  assert.equal(unsafe.design.width, 800); assert.equal(unsafe.design.padding, 16);
  assert.equal(unsafe.design.headingSize, 32); assert.equal(unsafe.design.font, "arial");
  assert.equal(unsafe.design.alignment, "left"); assert.equal(unsafe.design.textColor, "#4B4457");
});

test("every editable design setting reaches the email used for sending", () => {
  const html = renderEmailHtml({ campaign: campaign({ imageUrl: "https://example.com/hero.png", design: { font: "georgia", textSize: 20, headingSize: 40, alignment: "center", width: 720, padding: 22, radius: 8, textColor: "#123456", imagePosition: "below_heading" } }), merchant });
  for (const value of ["Georgia, Times, serif", "font-size:20px", "font-size:40px", "text-align:center", "max-width:720px", "padding:22px", "border-radius:8px", "color:#123456"]) assert.ok(html.includes(value), value);
  assert.ok(html.indexOf("<h1") < html.indexOf("hero.png"));
});

test("imported email keeps its design and personalization and receives a managed unsubscribe footer", () => {
  const html = renderEmailHtml({ campaign: campaign({ editorMode: "html", html: imported }), merchant, recipient, origin: "https://app.atrium-one.fr" });
  assert.match(html, /Bonjour Camille/); assert.match(html, /@media/);
  assert.match(html, /\/api\/emailing\/unsubscribe\?campaign=campaign-test&amp;recipient=recipient-token/);
  assert.match(html, /\/api\/emailing\/track\/open/);
  assert.ok(html.indexOf("Se désabonner") < html.indexOf("</body>"));
  assert.doesNotMatch(html, /Une belle surprise en boutique/);
});

test("personalization cannot insert HTML or interpret replacement metacharacters", () => {
  const malicious = { ...recipient, firstName: '<img src=x onerror="alert(1)"> $&' };
  const html = renderEmailHtml({ campaign: campaign({ editorMode: "html", html: "<p>{{first_name}}</p>" }), merchant, recipient: malicious });
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img src=x/);
  assert.equal(personalizeEmailText("Bonjour {{first_name}}", { firstName: "$&", lastName: "" }), "Bonjour $&");
});

test("converting a generated design to HTML preserves variables and does not bake in tracking or footer", () => {
  const html = renderEmailHtml({ campaign: campaign({}), merchant, includeFooter: false, preserveVariables: true });
  assert.match(html, /\{\{first_name\}\}/); assert.doesNotMatch(html, /Se désabonner|\/track\//);
  const sent = renderEmailHtml({ campaign: campaign({ editorMode: "html", html }), merchant, recipient, origin: "https://app.atrium-one.fr" });
  assert.match(sent, /Bonjour Camille/); assert.equal((sent.match(/Se désabonner/g) || []).length, 1);
});

test("preview stays isolated and has no live campaign tracking", () => {
  const html = isolatedEmailPreview(renderEmailHtml({ campaign: campaign({ editorMode: "html", html: imported }), merchant }));
  assert.match(html, /script-src 'none'/); assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(html, /\/api\/emailing\/track\//);
  assert.match(readFileSync(path.join(root, "app/emailing/EmailPreview.tsx"), "utf8"), /sandbox=""/);
});

function apiSetup(options = {}) {
  const saved = [], sent = [];
  let existing = options.existing;
  const mocks = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/merchants": { getMerchant: async () => options.loggedOut ? null : merchant },
    "@/lib/reviews": { getReviews: async () => [] },
    "@/lib/emailing-data": { getEmailingDashboardData: async () => ({ subscribers: [recipient], providerReady: true }) },
    "@/lib/emailing-segments": { filterEmailSubscribers: (value) => value, getEmailSegmentLabel: () => "Tous" },
    "@/lib/emailing-store": {
      createEmailRecipients: (value) => value,
      getEmailCampaign: async () => existing,
      createEmailCampaign: async (value) => { existing = JSON.parse(JSON.stringify({ ...value, id: "saved" })); saved.push(existing); return existing; },
      updateEmailCampaign: async (id, merchantId, value) => { assert.equal(merchantId, merchant.id); existing = JSON.parse(JSON.stringify({ ...value, id })); saved.push(existing); return existing; }
    },
    "@/lib/emailing-provider": { dispatchEmailCampaign: async ({ campaign: value }) => { sent.push(renderEmailHtml({ campaign: value, merchant, recipient, origin: "https://app.atrium-one.fr" })); return { ...value, status: "sent" }; } },
    "@/lib/gmail-connections": { getGmailConnection: async () => ({ gmail_address: "owner@example.test" }), isGmailConnectionReady: () => true, upsertGmailConnection: async () => {} },
    "@/lib/gmail-tokens": { getFreshGmailAccessToken: async () => "test-token" },
    "@/lib/gmail-messages": { sendGmailMessage: async (value) => { sent.push(value.html); } }
  };
  const handler = load(options.gmail ? "app/api/gmail/test/route.ts" : "app/api/emailing/campaigns/route.ts", mocks);
  const request = (value) => handler.POST(new Request("https://app.atrium-one.fr/api/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }));
  return { request, saved, sent };
}
const payload = { campaignType: "newsletter", segmentRules: [{ id: "all_customers" }], action: "draft", content: { subject: "Import", heading: "", body: "", editorMode: "html", html: imported, htmlFileName: "modele.html", design: { font: "georgia" } } };

test("campaign API saves and reopens imported HTML and design settings without requiring visual body fields", async () => {
  const { request, saved } = apiSetup();
  const response = await request(payload); assert.equal(response.status, 200);
  const draft = (await response.json()).campaign;
  assert.equal(draft.content.htmlFileName, "modele.html"); assert.match(draft.content.html, /@media/);
  assert.equal(draft.content.design.font, "georgia");
  const edit = await request({ ...payload, campaignId: draft.id, content: { ...draft.content, html: draft.content.html.replace("Découvrir", "Réserver") } });
  assert.equal(edit.status, 200); assert.equal(saved.length, 2); assert.match(saved[1].content.html, /Réserver/);
});

test("invalid or oversized HTML does not save or send, and authentication is still required", async () => {
  for (const gmail of [false, true]) {
    const denied = apiSetup({ gmail, loggedOut: true }); assert.equal((await denied.request(payload)).status, 401); assert.equal(denied.sent.length, 0);
    for (const html of ["<script>bad()</script>", "x".repeat(MAX_EMAIL_HTML_BYTES + 1)]) {
      const api = apiSetup({ gmail });
      assert.equal((await api.request({ ...payload, content: { ...payload.content, html } })).status, 400);
      assert.equal(api.saved.length, 0); assert.equal(api.sent.length, 0);
    }
  }
});

test("HTML editing cannot overwrite another merchant's campaign or a sent campaign", async () => {
  for (const [existing, status] of [[{ merchant_id: "other", status: "draft" }, 404], [{ merchant_id: merchant.id, status: "sent" }, 400]]) {
    const api = apiSetup({ existing }); assert.equal((await api.request({ ...payload, campaignId: "existing" })).status, status); assert.equal(api.saved.length, 0);
  }
});

test("test email and campaign sending both use the saved HTML renderer", async () => {
  for (const gmail of [false, true]) {
    const api = apiSetup({ gmail });
    assert.equal((await api.request({ ...payload, action: "send" })).status, 200);
    assert.equal(api.sent.length, 1); assert.match(api.sent[0], /@media/); assert.match(api.sent[0], /example.com\/offer/);
    assert.doesNotMatch(api.sent[0], /Votre campagne AtriumOne/);
  }
});
