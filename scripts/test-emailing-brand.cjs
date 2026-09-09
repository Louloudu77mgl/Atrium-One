const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./emailing-test-loader.cjs");
const { normalizeBrandColors, brandPalette } = load("lib/brand-palette.ts");
const { emailBrandFont } = load("lib/emailing-brand.ts");
const { emailArtDirection, emailGenerationPrompt } = load("lib/emailing-generation-prompt.ts");
const { prepareGeneratedEmailHtml, fallbackEmailHtml } = load("lib/emailing-generation.ts");
const { emailImagePrompt } = load("lib/emailing-image-prompt.ts");
const cheerio = require("cheerio");
const fixture = require("./emailing-generation-fixtures.cjs")[0];
const merchantId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

test("palette preserves three base roles and accepts more than 100 additional colors", () => {
  const colors = Array.from({ length: 120 }, (_, i) => `#${i.toString(16).padStart(6, "0")}`);
  assert.equal(normalizeBrandColors(colors).length, 120);
  assert.deepEqual(normalizeBrandColors([" #abcdef ", "#ABCDEF", "red", "url(x)", null]), ["#ABCDEF"]);
  assert.equal(brandPalette({ primary_color: "#FF0000", secondary_color: "#00FF00", accent_color: "#0000FF", additional_colors: colors }).length, 123);
});

function paletteStore({ downloadError, uploadError, stored, isPublic = false } = {}) {
  const records = [], paths = [];
  const storage = { getBucket: async () => ({ data: { public: isPublic } }), from: (bucket) => {
    assert.equal(bucket, "emailing-data");
    return { download: async (path) => { paths.push(path); return downloadError ? { error: downloadError } : { data: new Blob([JSON.stringify(stored ?? records.at(-1))]) }; }, upload: async (path, buffer, options) => { paths.push(path); assert.equal(options.upsert, true); assert.equal(options.cacheControl, "0"); records.push(JSON.parse(buffer)); return { error: uploadError }; } };
  } };
  return { ...load("lib/brand-palette-store.ts", { "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ storage }) } }), records, paths };
}

test("additional colors and chosen font survive private merchant-scoped storage and clearing", async () => {
  const store = paletteStore();
  await store.saveBrandPalette(merchantId, ["#112233", "#aabbcc"], "Playfair Display");
  assert.deepEqual(await store.readBrandPalette(merchantId), { additional_colors: ["#112233", "#AABBCC"], font_family: "Playfair Display" });
  await store.saveBrandPalette(merchantId, [], "Georgia");
  assert.deepEqual(await store.readBrandPalette(merchantId), { additional_colors: [], font_family: "Georgia" });
  assert.ok(store.paths.every((path) => path === `merchants/${merchantId}/brand-palette.json`));
});

test("legacy accounts with no palette load normally; failures are never silently treated as empty", async () => {
  assert.deepEqual(await paletteStore({ downloadError: { statusCode: 404, message: "Object not found" } }).readBrandPalette(merchantId), { additional_colors: [] });
  await assert.rejects(paletteStore({ downloadError: { statusCode: 503, message: "network" } }).readBrandPalette(merchantId), /charger/);
  await assert.rejects(paletteStore({ stored: { version: 1, merchant_id: otherId, additional_colors: ["#ABCDEF"] } }).readBrandPalette(merchantId), /invalide/);
  await assert.rejects(paletteStore().readBrandPalette("../another-merchant"), /invalide/);
  await assert.rejects(paletteStore({ isPublic: true }).saveBrandPalette(merchantId, [], "Sora"), /privé/);
  await assert.rejects(paletteStore({ uploadError: { message: "failed" } }).saveBrandPalette(merchantId, [], "Sora"), /sauvegardées/);
});

test("settings action resolves authenticated merchant, keeps three roles and persists all extras", async () => {
  const writes = [], paletteWrites = [], revalidated = [];
  const merchant = { id: merchantId };
  const { updateBrandSettings } = load("lib/brand-settings.ts", {
    "next/cache": { revalidatePath: (path) => revalidated.push(path) }, "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "@/lib/merchants": { getMerchant: async () => merchant },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "row" } }) }) }), update: (payload) => ({ eq: async (field, value) => { assert.equal(field, "merchant_id"); assert.equal(value, merchantId); writes.push(payload); return { error: null }; } }) }) }) },
    "@/lib/brand-palette-store": { saveBrandPalette: async (...args) => paletteWrites.push(args) }
  });
  const form = new FormData(); for (const [key, value] of Object.entries({ merchant_id: otherId, primary_color: "#123456", secondary_color: "#FEDCBA", accent_color: "#543210", social_font_family: "Georgia" })) form.set(key, value);
  form.append("additional_colors", "#ABCDEF"); form.append("additional_colors", "#112233");
  await assert.rejects(updateBrandSettings(form), /redirect:\/settings\?saved=1/);
  assert.equal(writes[0].primary_color, "#123456"); assert.equal(writes[0].secondary_color, "#FEDCBA"); assert.equal(writes[0].accent_color, "#543210");
  assert.equal(writes[0].additional_colors, undefined); assert.deepEqual(paletteWrites, [[merchantId, ["#ABCDEF", "#112233"], "Georgia"]]); assert.ok(revalidated.includes("/emailing"));
  form.append("additional_colors", "bad css"); await assert.rejects(updateBrandSettings(form), /redirect:.*error/); assert.equal(writes.length, 1);
});

test("brand reader enriches existing rows and restores the saved font on older SQL schemas", async () => {
  const { getBrandSettings } = load("lib/brand-settings.ts", {
    "next/cache": {}, "next/navigation": {}, "@/lib/merchants": {}, "@/lib/supabase/server": {},
    "@/lib/brand-palette-store": { readBrandPalette: async (id) => { assert.equal(id, merchantId); return { additional_colors: ["#123456"], font_family: "Montserrat" }; } }
  });
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { primary_color: "#112233" } }) }) }) }) };
  const brand = await getBrandSettings({ id: merchantId }, client);
  assert.equal(brand.social_font_family, "Montserrat"); assert.deepEqual(brand.additional_colors, ["#123456"]);
});

test("brand colors and font override sector inspiration in both text and image context", () => {
  const input = { ...fixture, branding: { primary: "#123456", secondary: "#F4F5F6", accent: "#654321", additionalColors: ["#AABBCC", "#334455"], fontFamily: "Montserrat" } };
  const direction = emailArtDirection(input), context = JSON.parse(emailGenerationPrompt(input, direction, []));
  assert.equal(direction.primary, "#123456"); assert.match(direction.titleFont, /^'Montserrat', Arial/); assert.equal(direction.bodyFont, direction.titleFont);
  assert.deepEqual(context.direction.palette, ["#123456", "#F4F5F6", "#654321", "#AABBCC", "#334455"]);
  const imagePrompt = emailImagePrompt({ merchant: { business_name: "Test" }, brand: { primary_color: "#123456", additional_colors: ["#AABBCC"] }, brief: "Croissant" });
  assert.match(imagePrompt, /#AABBCC/);
});

test("chosen font is enforced in final HTML, even if model used other fonts or shorthands", () => {
  const input = { ...fixture, branding: { ...fixture.branding, fontFamily: "Playfair Display", additionalColors: ["#123456"] } };
  const html = prepareGeneratedEmailHtml(fallbackEmailHtml(input), input), $ = cheerio.load(html);
  for (const element of $("h1,h2,p,a,td").toArray()) assert.match($(element).attr("style"), /font-family:\s*'Playfair Display', Georgia, 'Times New Roman', serif/);
  assert.doesNotMatch(html, /@font-face|fonts\.google|var\(--font/);
  assert.equal(emailBrandFont("';background:url(https://bad)"), null);
  assert.match(emailBrandFont("Georgia").stack, /^Georgia/); assert.match(emailBrandFont("Trebuchet MS").stack, /Arial/);
});

test("email without the actual primary brand color is rejected for rewriting", () => {
  const raw = fallbackEmailHtml(fixture).replaceAll(fixture.branding.primary, "#112244");
  assert.throws(() => prepareGeneratedEmailHtml(raw, fixture), /couleur principale/);
});
