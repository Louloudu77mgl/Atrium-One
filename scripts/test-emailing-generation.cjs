const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./emailing-test-loader.cjs");
const fixtures = require("./emailing-generation-fixtures.cjs");
const cheerio = require("cheerio");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { emailArtDirection, EMAIL_HTML_SYSTEM_PROMPT } = load("lib/emailing-generation-prompt.ts");
const { generateEmailHtml, prepareGeneratedEmailHtml, fallbackEmailHtml, emailHtmlMetadata } = load("lib/emailing-generation.ts");
const { normalizeEmailContent } = load("lib/emailing-content.ts");
const { renderEmailHtml } = load("lib/emailing-template.ts");

for (const fixture of fixtures) test(`newsletter ${fixture.id}: distinct brand, sections, responsive tables, hero and final send`, async () => {
  const html = await generateEmailHtml(fixture, { apiKey: "" });
  const $ = cheerio.load(html), metadata = emailHtmlMetadata(html);
  assert.match(html, /^<!DOCTYPE html>/); assert.equal($("h1").length, 1); assert.ok($("h2").length >= 1);
  assert.ok($('[id^="email-"]').length >= 4); assert.ok($("table").length >= 3);
  assert.match(html, new RegExp(fixture.branding.primary)); assert.match(html, /max-width:620px| max-width: 620px/); assert.match(html, /@media/);
  assert.ok(metadata.subject); assert.ok(metadata.preheader); assert.ok($("img").attr("alt"));
  assert.match($("img").attr("style"), /height:\s*auto/);
  assert.doesNotMatch(html, /display:\s*(?:grid|flex)|position:\s*absolute|<script|https:\/\/fonts\./);
  const content = normalizeEmailContent({ ...metadata, editorMode: "html", html });
  const sent = renderEmailHtml({ campaign: { id: "test", merchant_id: "merchant", content: JSON.parse(JSON.stringify(content)) }, merchant: { business_name: fixture.business.name, city: fixture.business.city, logo_url: null, website_url: fixture.business.website }, recipient: { firstName: "Marie", lastName: "Martin", token: "test", id: "id", email: "test@example.test" }, origin: "https://app.atrium-one.fr" });
  assert.match(sent, /Bonjour Marie/); assert.match(sent, /api\/emailing\/unsubscribe/); assert.match(sent, new RegExp(fixture.branding.primary)); assert.match(sent, /<!--\[if mso\]>/);
});

test("sector directions and content-driven layout choices are genuinely different", () => {
  const directions = fixtures.map(emailArtDirection);
  assert.equal(new Set(directions.map((item) => item.layout)).size, 3);
  assert.equal(new Set(directions.map((item) => item.primary)).size, 3);
  assert.equal(new Set(directions.map((item) => item.style)).size, 3);
  assert.notEqual(emailArtDirection({ ...fixtures[0], variant: 1 }).layout, emailArtDirection({ ...fixtures[0], variant: 2 }).layout);
  assert.equal(emailArtDirection({ ...fixtures[0], branding: {} }).primary, "#895334");
  assert.equal(emailArtDirection({ ...fixtures[1], branding: { primary: "#123456" } }).primary, "#123456");
});

test("Responses request asks for final HTML, contains brand and real media, and stores no API response", async () => {
  const fixture = fixtures[1];
  const html = await generateEmailHtml(fixture, { apiKey: "test-only", fetcher: async (url, request) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(request.body); assert.equal(body.instructions, EMAIL_HTML_SYSTEM_PROMPT); assert.equal(body.store, false); assert.equal(body.text.format.type, "text"); assert.ok(body.max_output_tokens >= 6000);
    const input = JSON.parse(body.input); assert.equal(input.business.name, fixture.business.name); assert.equal(input.images[0].url, fixture.images[0].url); assert.equal(input.direction.layout, "premium");
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: fallbackEmailHtml(fixture) }] }] });
  } });
  assert.match(html, /Maison Sauge/);
});

test("generation rejects invented URLs, images, truncated markup, simplistic layouts and web CSS", () => {
  const input = fixtures[0], raw = fallbackEmailHtml(input);
  assert.throws(() => prepareGeneratedEmailHtml(raw.replaceAll(input.business.website, "https://invented.example"), input), /Destination/);
  assert.throws(() => prepareGeneratedEmailHtml(raw.replaceAll(input.images[0].url.replaceAll("&", "&amp;"), "https://invented.example/photo.png"), input), /Image/);
  assert.throws(() => prepareGeneratedEmailHtml(raw.slice(0, -10), input), /incomplet/);
  assert.throws(() => prepareGeneratedEmailHtml(raw.replace("padding:32px", "display:grid;padding:32px"), input), /compatible/);
  assert.throws(() => prepareGeneratedEmailHtml("<!DOCTYPE html><html><body><h1>Titre</h1><p>Texte</p></body></html>", input), /insuffisante/);
});

test("network failure and incomplete output return an explicit safe fallback, not an empty email", async () => {
  for (const fetcher of [async () => { throw new Error("network"); }, async () => Response.json({ status: "incomplete", output_text: "<!DOCTYPE html>" }), async () => Response.json({ error: "quota" }, { status: 429 })]) {
    let notice = ""; const html = await generateEmailHtml(fixtures[2], { apiKey: "test-only", fetcher, onFallback: (message) => { notice = message; } });
    assert.match(notice, /secours/); assert.match(html, /email-editorial/); assert.match(html, /La Table des Saisons/);
  }
});

test("no-photo brief stays composed without invented images, discounts or facts", async () => {
  const html = await generateEmailHtml({ ...fixtures[0], images: [], campaign: { type: "reactivation", brief: "Inviter nos clients à nous retrouver." } }, { apiKey: "" });
  assert.doesNotMatch(html, /<img|% de|code promo|offert|placeholder|IMAGE_URL/); assert.match(html, /email-editorial/);
  assert.doesNotMatch(html, /Inviter nos clients/);
});

test("mobile stacking includes spacer cells and parent rows, not only content columns", () => {
  const input = fixtures[1], raw = fallbackEmailHtml(input).replace('<h2', '<table width="100%"><tr><td class="email-column">A</td><td class="email-stack-gap"> </td><td class="email-column">B</td></tr></table><h2');
  const $ = cheerio.load(prepareGeneratedEmailHtml(raw, input));
  assert.equal($(".atrium-stack-row").length, 1); assert.equal($(".atrium-stack-cell").length, 3);
  assert.match($("style#atrium-email-responsive").text(), /atrium-stack-table>tbody/);
});

test("generated primary CTA retains click tracking without changing secondary or edited links", () => {
  const fixture = fixtures[0], html = prepareGeneratedEmailHtml(fallbackEmailHtml(fixture), fixture), metadata = emailHtmlMetadata(html);
  const render = (markup) => renderEmailHtml({ campaign: { id: "test", merchant_id: "merchant", content: normalizeEmailContent({ ...metadata, editorMode: "html", html: markup }) }, merchant: { business_name: "Test", city: "Lyon", logo_url: null, website_url: fixture.business.website }, recipient: { firstName: "Marie", lastName: "", id: "id", email: "test@example.test", token: "token" }, origin: "https://app.atrium-one.fr" });
  assert.ok(metadata.ctaUrl); assert.match(render(html), /api\/emailing\/track\/click/);
  const edited = html.replaceAll(metadata.ctaUrl, "https://changed.example/");
  assert.doesNotMatch(render(edited), /api\/emailing\/track\/click/); assert.match(render(edited), /https:\/\/changed.example/);
});

test("generate API preserves HTML mode, uses merchant gallery first and refuses unauthenticated requests", async () => {
  let imageCalls = 0;
  function handler(loggedOut = false) { return load("app/api/emailing/generate/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/merchants": { getMerchant: async () => loggedOut ? null : { id: "merchant", business_name: "Test" } },
    "@/lib/brand-settings": { getBrandSettings: async () => null },
    "@/lib/emailing-generation-assets": { getEmailGenerationImages: async (id) => { assert.equal(id, "merchant"); return fixtures[0].images; } },
    "@/lib/social-visuals": { generateAndStoreSocialVisual: async () => { imageCalls++; return null; } },
    "@/lib/emailing-hans": { generateEmailWithHans: async (input) => { assert.equal(input.images.length, 1); return { subject: "Test", editorMode: "html", html: "<p>Test</p>" }; } }
  }).POST; }
  const request = () => new Request("https://app.atrium-one.fr/api/emailing/generate", { method: "POST", body: JSON.stringify({ brief: "Nouveautés", campaignType: "newsletter" }) });
  const result = await handler()(request()); assert.equal(result.status, 200); assert.equal((await result.json()).content.editorMode, "html"); assert.equal(imageCalls, 0);
  assert.equal((await handler(true)(request())).status, 401);
  const wizard = readFileSync(path.join(__dirname, "../app/emailing/EmailCampaignWizard.tsx"), "utf8");
  assert.match(wizard, /editorMode: payload.content.editorMode/); assert.doesNotMatch(wizard, /payload.content, editorMode: "visual"/);
});
