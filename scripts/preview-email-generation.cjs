// Explicit opt-in live API validation, using only fictional fixtures. Never sends email.
const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const { load } = require("./emailing-test-loader.cjs");
const fixtures = require("./emailing-generation-fixtures.cjs");
const { generateEmailHtml, prepareGeneratedEmailHtml, fallbackEmailHtml, emailHtmlMetadata } = load("lib/emailing-generation.ts");
const args = process.argv.slice(2), live = args.includes("--live");
const flag = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const output = flag("--output");
if (!output || !path.isAbsolute(output)) throw new Error("--output requires an absolute artifact directory");
if (live && flag("--env-file")) {
  const env = parseEnv(fs.readFileSync(flag("--env-file"), "utf8"));
  for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_EMAIL_MODEL"]) if (env[key]) process.env[key] = env[key];
}
if (live && !process.env.OPENAI_API_KEY) throw new Error("No API key configured for live validation");
fs.mkdirSync(output, { recursive: true });
Promise.all(fixtures.filter((fixture) => !flag("--only") || fixture.id === flag("--only")).map(async ({ id, ...input }) => {
  if (args.includes("--brand-regression")) input.branding = { ...input.branding, primary: "#126E82", secondary: "#F4F7FA", accent: "#DF6885", additionalColors: ["#F1B23D", "#335577"], fontFamily: "Trebuchet MS" };
  const start = Date.now(); const notice = live ? "" : "Exemple de mise en page hors ligne, pas une génération IA.", diagnostic = "";
  const html = args.includes("--revalidate") ? prepareGeneratedEmailHtml(fs.readFileSync(path.join(output, `${id}.html`), "utf8"), input) : live ? await generateEmailHtml(input) : prepareGeneratedEmailHtml(fallbackEmailHtml(input), input);
  fs.writeFileSync(path.join(output, `${id}.html`), html);
  const result = { id, source: live ? "live-model" : "offline-layout", elapsedMs: Date.now() - start, bytes: Buffer.byteLength(html), ...emailHtmlMetadata(html), notice, diagnostic };
  console.log(JSON.stringify({ id: result.id, source: result.source, elapsedMs: result.elapsedMs, bytes: result.bytes, subject: result.subject, notice, diagnostic }));
  return result;
})).then((results) => {
  fs.writeFileSync(path.join(output, "validation.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(output, "index.html"), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Validation newsletters AtriumOne</title></head><body style="margin:0;background:#ecebea;font-family:Arial"><h1 style="padding:20px">Trois commerces, trois identités</h1><p style="padding:0 20px">Commerces fictifs · ${live ? "Test du modèle réel" : "Compositions de secours"} · Aucun email envoyé</p><div style="display:flex;flex-wrap:wrap;gap:16px;padding:20px">${results.map((result) => `<section style="flex:1;min-width:320px"><h2>${result.id}</h2><p>${result.source}</p><iframe title="Newsletter ${result.id}" src="${result.id}.html" sandbox="allow-same-origin" style="border:0;width:100%;height:1800px;background:white"></iframe></section>`).join("")}</div></body></html>`);
  if (live && results.some((result) => result.source !== "live-model")) process.exitCode = 1;
}).catch((error) => { console.error(error.message); process.exitCode = 1; });
