const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./emailing-test-loader.cjs");
const fixtures = require("./emailing-generation-fixtures.cjs");
const cheerio = require("cheerio");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { emailArtDirection, EMAIL_HTML_SYSTEM_PROMPT } = load("lib/emailing-generation-prompt.ts");
const { generateEmailHtml, prepareGeneratedEmailHtml, fallbackEmailHtml, emailHtmlMetadata, assertEmailBriefWasInterpreted } = load("lib/emailing-generation.ts");
const { normalizeEmailContent } = load("lib/emailing-content.ts");
const { renderEmailHtml } = load("lib/emailing-template.ts");

for (const fixture of fixtures) test(`newsletter ${fixture.id}: distinct brand, sections, responsive tables, hero and final send`, async () => {
  const html = prepareGeneratedEmailHtml(fallbackEmailHtml(fixture), fixture);
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
    assert.equal(input.creativeBrief.instructionsToInterpret, fixture.campaign.brief); assert.equal(input.creativeBrief.publishVerbatim, false); assert.equal(input.campaign.brief, undefined);
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

test("network failure, quota and incomplete output never return a fake successful generation", async () => {
  for (const fetcher of [async () => { throw new Error("network"); }, async () => Response.json({ status: "incomplete", output_text: "<!DOCTYPE html>" }), async () => Response.json({ error: "quota" }, { status: 429 })]) {
    await assert.rejects(generateEmailHtml(fixtures[2], { apiKey: "test-only", fetcher }), /Aucun email de remplacement/);
  }
  await assert.rejects(generateEmailHtml(fixtures[0], { apiKey: "" }), /n’est pas configurée/);
});

test("no-photo brief stays composed without invented images, discounts or facts", async () => {
  const input = { ...fixtures[0], images: [], campaign: { type: "reactivation", brief: "Inviter nos clients à nous retrouver." } };
  const html = prepareGeneratedEmailHtml(fallbackEmailHtml(input), input);
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

test("generate API always creates a new campaign image, ignores gallery and refuses unauthenticated requests", async () => {
  let imageCalls = 0;
  function handler(loggedOut = false) { return load("app/api/emailing/generate/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/merchants": { getMerchant: async () => loggedOut ? null : { id: "merchant", business_name: "Test" } },
    "@/lib/brand-settings": { getBrandSettings: async () => null },
    "@/lib/emailing-generation-assets": { getEmailGenerationImages: async () => { assert.fail("The gallery must not replace freshly generated images"); } },
    "@/lib/social-visuals": { generateAndStoreSocialVisual: async (input) => { imageCalls++; assert.equal(input.format, "email"); assert.equal(input.source, "Nouveautés"); return { imageUrl: `https://assets.example/ai-${imageCalls}.png` }; } },
    "@/lib/emailing-hans": { generateEmailWithHans: async (input) => { assert.equal(input.images.length, 1); assert.equal(input.images[0].url, `https://assets.example/ai-${imageCalls}.png`); return { subject: "Test", editorMode: "html", html: "<p>Test</p>" }; } }
  }).POST; }
  const request = () => new Request("https://app.atrium-one.fr/api/emailing/generate", { method: "POST", body: JSON.stringify({ brief: "Nouveautés", campaignType: "newsletter" }) });
  const result = await handler()(request()); assert.equal(result.status, 200); const payload = await result.json(); assert.equal(payload.content.editorMode, "html"); assert.equal(payload.imageSource, "generated"); assert.equal(imageCalls, 1);
  assert.equal((await handler()(request())).status, 200); assert.equal(imageCalls, 2);
  assert.equal((await handler(true)(request())).status, 401);
  const wizard = readFileSync(path.join(__dirname, "../app/emailing/EmailCampaignWizard.tsx"), "utf8");
  assert.match(wizard, /editorMode: payload.content.editorMode/); assert.doesNotMatch(wizard, /payload.content, editorMode: "visual"/);
});

test("conversational instructions cannot leak into body, subject, preheader or image alt", () => {
  for (const brief of ["Je veux un mail chaleureux pour annoncer notre croissant praliné noisette.", "J’aimerais une newsletter élégante pour notre institut. Mets en avant notre nouveau soin de cinquante minutes.", "Fais-moi un mail pour notre nouvelle carte. Il faut un design gourmand et des grandes photos.", "Peux-tu rédiger un email pour remercier nos clients les plus fidèles ?"] ) {
    const input = { ...fixtures[0], campaign: { ...fixtures[0].campaign, brief } };
    for (const html of [`<html><body><p>${brief}</p></body></html>`, `<html><head><title>${brief}</title></head></html>`, `<html><head><meta name="description" content="${brief}"></head></html>`, `<img alt="${brief}" src="https://example.test/image.png">`]) assert.throws(() => assertEmailBriefWasInterpreted(html, input), /recopié/);
    assert.doesNotThrow(() => assertEmailBriefWasInterpreted("<p>Notre croissant praliné noisette vous attend. Venez le découvrir !</p>", input));
    assert.doesNotMatch(fallbackEmailHtml(input), /Je veux|J’aimerais|Fais-moi|Peux-tu/);
  }
});

test("valid commercial facts and client-facing CTA are not mistaken for production instructions", () => {
  const input = { ...fixtures[0], campaign: { type: "promotion", brief: "Le croissant praliné noisette est à 3 euros du 10 au 15 septembre. Code DOUCEUR. Découvrez notre nouveauté." } };
  assert.doesNotThrow(() => assertEmailBriefWasInterpreted("<p>Le croissant praliné noisette est à 3 euros du 10 au 15 septembre.</p><a>Découvrez notre nouveauté</a><p>Code DOUCEUR</p>", input));
});

test("copied brief triggers exactly one fresh rewrite with validation feedback", async () => {
  const input = { ...fixtures[0], campaign: { type: "newsletter", brief: "Je veux un mail chaleureux pour annoncer notre nouveau pain au levain." } };
  const clean = fallbackEmailHtml(input), copied = clean.replace("</h1>", `</h1><p>${input.campaign.brief}</p>`);
  let calls = 0;
  const html = await generateEmailHtml(input, { apiKey: "test-only", fetcher: async (_, request) => {
    calls++; const body = JSON.parse(request.body);
    if (calls === 2) assert.match(body.instructions, /CORRECTION OBLIGATOIRE.*recopié/);
    return Response.json({ status: "completed", output_text: calls === 1 ? copied : clean });
  } });
  assert.equal(calls, 2); assert.doesNotMatch(html, /Je veux un mail/);
  calls = 0;
  await assert.rejects(generateEmailHtml(input, { apiKey: "test-only", fetcher: async () => { calls++; return Response.json({ status: "completed", output_text: copied }); } }), /deux tentatives/);
  assert.equal(calls, 2);
});

test("image failure returns an actionable API error, no stock image and no email", async () => {
  const { POST } = load("app/api/emailing/generate/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/merchants": { getMerchant: async () => ({ id: "merchant", business_name: "Test" }) },
    "@/lib/brand-settings": { getBrandSettings: async () => null },
    "@/lib/social-visuals": { generateAndStoreSocialVisual: async () => { throw new Error("provider secret diagnostic"); } },
    "@/lib/emailing-hans": { generateEmailWithHans: async () => assert.fail("No email without generated image") }
  });
  const response = await POST(new Request("https://app.atrium-one.fr/api/emailing/generate", { method: "POST", body: JSON.stringify({ brief: "Notre nouveau pain", campaignType: "newsletter" }) }));
  assert.equal(response.status, 502); const payload = await response.json(); assert.equal(payload.content, undefined); assert.match(payload.error, /aucune photo de remplacement/); assert.doesNotMatch(payload.error, /secret|diagnostic/);
});

test("email image generation stores actual API bytes in fresh, non-overwriting campaign paths", async () => {
  const uploads = [], inserts = [], apiBodies = [];
  const originalFetch = global.fetch, originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    storage: { from: (bucket) => { assert.equal(bucket, "social-visuals"); return { upload: async (key, bytes, options) => { uploads.push({ key, bytes, options }); return { error: null }; }, getPublicUrl: (key) => ({ data: { publicUrl: `https://assets.example/${key}` } }) }; } },
    from: (table) => { assert.equal(table, "generated_visuals"); return { insert: async (record) => { inserts.push(record); return { error: null }; } }; }
  };
  global.fetch = async (url, request) => { assert.equal(url, "https://api.openai.com/v1/images/generations"); apiBodies.push(JSON.parse(request.body)); return Response.json({ data: [{ b64_json: Buffer.from("actual-image-bytes").toString("base64") }] }); };
  try {
    const { generateAndStoreSocialVisual } = load("lib/social-visuals.ts", {
      "@/lib/social-editor/layout-safety": { fitEstimatedText: () => assert.fail("No social overlay in email generation") },
      "@/lib/supabase/server": { createServerSupabaseClient: async () => supabase }, "@/lib/brand-settings": { getBrandSettings: async () => null }
    });
    for (let i = 0; i < 2; i++) await generateAndStoreSocialVisual({ merchant: { id: "merchant", business_name: "Test", business_type: "Boulangerie" }, title: "Campagne", caption: "Je veux un mail pour notre croissant praliné", format: "email", brandSettings: null });
    assert.equal(uploads.length, 2); assert.notEqual(uploads[0].key, uploads[1].key);
    for (const upload of uploads) { assert.match(upload.key, /^owner\/email-campaigns\/ai-/); assert.equal(upload.bytes.toString(), "actual-image-bytes"); assert.equal(upload.options.upsert, false); }
    for (const body of apiBodies) { assert.equal(body.size, "1536x1024"); assert.equal(body.n, 1); assert.equal(body.quality, "medium"); assert.match(body.prompt, /NOUVELLE photographie/); assert.doesNotMatch(body.prompt, /Titre du post|PRIORITÉ ABSOLUE|texte social/); }
    assert.equal(inserts.length, 2); assert.match(inserts[0].generated_image_url, /email-campaigns\/ai-/);
  } finally { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; }
});
