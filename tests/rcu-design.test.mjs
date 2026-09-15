import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("l’affiche RCU reste un A4 haute définition avec un QR généreux", () => {
  const dimensions = read("../lib/social-editor/document.ts");
  const poster = read("../lib/rcu.ts");
  const studio = read("../app/rcu/[slug]/poster/RcuPosterStudio.tsx");
  assert.match(dimensions, /a4:\s*\{\s*width:\s*1240,\s*height:\s*1754/);
  assert.match(poster, /buildRcuQrApiUrl\(origin, form.slug, 720\)/);
  assert.match(poster, /width:\s*340,\s*\n\s*height:\s*340/);
  assert.match(studio, /renderDocumentToDataUrl\(document, settings, \{ scale: 2 \}\)/);
  assert.match(studio, /@page\{size:A4 portrait;margin:0\}/);
});

test("affiche et landing RCU partagent la direction artistique des e-mails et la marque du commerce", () => {
  const brand = read("../lib/rcu-brand.ts");
  const poster = read("../lib/rcu.ts");
  const landing = read("../app/rcu/[slug]/RcuGameExperience.tsx");
  assert.match(brand, /emailArtDirection/);
  assert.match(poster, /getRcuConsumerBrand\(merchant, brandSettings\)/);
  assert.match(poster, /merchant\.logo_url/);
  assert.match(landing, /getRcuConsumerBrand\(merchant, brandSettings\)/);
  assert.match(landing, /max-w-\[460px\]/);
  assert.doesNotMatch(landing, /propulsée par Hans/i);
});

test("la recette hebdomadaire est opérationnelle, réglable et mise en avant", () => {
  const templates = read("../app/automations/automation-builder/templates.ts");
  const cards = read("../app/automations/automation-builder/AutomationTemplates.tsx");
  const workspace = read("../app/automations/AutomationsWorkspace.tsx");
  const cron = read("../app/api/cron/social-automation/route.ts");
  assert.match(templates, /Publier automatiquement sur Instagram chaque semaine/);
  assert.match(templates, /posts_per_week.*min:\s*1, max:\s*7/);
  assert.match(cards, /Nouveau · Recommandé/);
  assert.match(workspace, /social_posts_per_cycle:\s*postsPerWeek/);
  assert.match(cron, /runWeeklySocialAutomations/);
});
