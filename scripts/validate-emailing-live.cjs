// Explicit paid API opt-in, fictional businesses only. Storage is LOCAL, no emails sent.
const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const assert = require("node:assert/strict");
const { load } = require("./emailing-test-loader.cjs");
const fixtures = require("./emailing-generation-fixtures.cjs");
const { generateEmailHtml, emailHtmlMetadata } = load("lib/emailing-generation.ts");
const args = process.argv.slice(2), flag = (key) => args[args.indexOf(key) + 1];
if (!args.includes("--live")) throw new Error("Requires --live: calls paid text and image APIs, never Supabase.");
const output = flag("--output");
if (!args.includes("--output") || !path.isAbsolute(output)) throw new Error("--output requires an absolute artifact directory");
if (args.includes("--env-file")) {
  const env = parseEnv(fs.readFileSync(flag("--env-file"), "utf8"));
  for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_EMAIL_MODEL", "OPENAI_IMAGE_MODEL"]) if (env[key]) process.env[key] = env[key];
}
if (!process.env.OPENAI_API_KEY) throw new Error("API key not configured");
const { generateAndStoreSocialVisual } = load("lib/social-visuals.ts", {
  "@/lib/supabase/server": { createServerSupabaseClient: () => { throw new Error("Production storage forbidden in validation"); } },
  "@/lib/brand-settings": { getBrandSettings: async () => null },
  "@/lib/social-editor/layout-safety": { fitEstimatedText: () => { throw new Error("Social overlay not used"); } }
});
const briefs = [
  "Je veux un mail chaleureux pour annoncer notre croissant praliné noisette. Mets une grande photo et invite les clients à venir le goûter cette semaine. Il faut un design gourmand et pas de réduction inventée.",
  "J’aimerais un mail premium pour présenter notre rituel Éclat : nettoyage doux, massage du visage et masque hydratant, durée 50 minutes. Fais un design apaisant et ajoute une photo. Invite les clientes à prendre rendez-vous sans inventer le prix.",
  "Fais-moi une newsletter pour annoncer la nouvelle carte d’automne : velouté de potimarron, poisson du marché et légumes rôtis, poire pochée aux épices. Mets en avant la cuisine de saison, une grande image et un bouton pour réserver. Ton convivial, aucun prix inventé."
];
fs.mkdirSync(output, { recursive: true });
Promise.all(fixtures.map(async (fixture, index) => {
  const start = Date.now(), imageFile = `${fixture.id}.png`, brief = briefs[index];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "local-validation" } } }) },
    storage: { from: () => ({ upload: async (_, bytes, options) => { assert.equal(options.upsert, false); assert.ok(bytes.length > 1000); fs.writeFileSync(path.join(output, imageFile), bytes); return { error: null }; }, getPublicUrl: () => ({ data: { publicUrl: `http://127.0.0.1:3211/${imageFile}` } }) }) },
    from: () => ({ insert: async () => ({ error: null }) })
  };
  const merchant = { id: `fictional-${fixture.id}`, business_name: fixture.business.name, business_type: fixture.business.sector, description: fixture.business.description, city: fixture.business.city };
  const brand = { primary_color: fixture.branding.primary, secondary_color: fixture.branding.secondary, accent_color: fixture.branding.accent, tone: fixture.branding.tone, visual_style: fixture.branding.style };
  const visual = await generateAndStoreSocialVisual({ merchant, title: "Campagne", caption: brief, source: brief, format: "email", brandSettings: brand, supabaseClient: supabase, signal: AbortSignal.timeout(75_000) });
  console.log(JSON.stringify({ id: fixture.id, stage: "image-generated", elapsedMs: Date.now() - start, bytes: fs.statSync(path.join(output, imageFile)).size }));
  const input = { ...fixture, campaign: { ...fixture.campaign, brief }, images: [{ url: visual.imageUrl, alt: `Illustration de campagne ${fixture.business.name}` }] };
  const html = await generateEmailHtml(input);
  assert.ok(html.includes(visual.imageUrl)); assert.ok(!html.includes("images.unsplash.com"));
  fs.writeFileSync(path.join(output, `${fixture.id}.html`), html);
  const result = { id: fixture.id, source: "live-text-and-image-apis", elapsedMs: Date.now() - start, ...emailHtmlMetadata(html) };
  console.log(JSON.stringify({ id: result.id, stage: "email-validated", elapsedMs: result.elapsedMs, subject: result.subject }));
  return result;
})).then((results) => fs.writeFileSync(path.join(output, "validation.json"), JSON.stringify(results, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
