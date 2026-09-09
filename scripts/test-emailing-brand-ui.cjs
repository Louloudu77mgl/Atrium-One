const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLFormElement", "Event", "MouseEvent"]) global[key] = key === "window" ? dom.window : key === "document" ? dom.window.document : dom.window[key];
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
const { load } = require("./emailing-test-loader.cjs");
const button = (text) => [...document.querySelectorAll("button")].find((node) => node.textContent.includes(text));
async function click(text) { const node = button(text); assert.ok(node, `Button ${text} exists`); await act(async () => node.click()); }
async function mount(element) { const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); await act(async () => root.render(element)); return async () => { await act(async () => root.unmount()); host.remove(); }; }

test("settings keeps three base colors, adds/removes many extras and selects the shared font", async () => {
  const { BrandStyleForm } = load("app/settings/SettingsClientForms.tsx");
  const unmount = await mount(React.createElement(BrandStyleForm, { brandSettings: null, businessName: "Test", action: async () => {} }));
  try {
    assert.equal(document.querySelectorAll('input[type="color"]').length, 3);
    for (let index = 0; index < 12; index++) await click("Ajouter une couleur");
    assert.equal(document.querySelectorAll('input[name="additional_colors"]').length, 12);
    assert.equal(new Set([...document.querySelectorAll('input[name="additional_colors"]')].map((node) => node.value)).size, 12);
    await click("Retirer"); assert.equal(document.querySelectorAll('input[name="additional_colors"]').length, 11);
    for (const name of ["primary_color", "secondary_color", "accent_color"]) assert.ok(document.querySelector(`input[name="${name}"]`));
    await click("Police sélectionnée"); await click("Playfair Display");
    const fields = new dom.window.FormData(document.querySelector("form"));
    assert.equal(fields.get("social_font_family"), "Playfair Display"); assert.equal(fields.getAll("additional_colors").length, 11);
    assert.match(document.body.textContent, /publications et e-mails/); assert.match(document.body.textContent, /messagerie utilise Georgia/);
  } finally { await unmount(); }
});

for (const success of [true, false]) test(`existing Hans screen covers email generation and closes on ${success ? "success" : "failure"}`, async () => {
  const oldFetch = global.fetch; let finish, requests = 0;
  global.fetch = async (url) => { assert.equal(url, "/api/emailing/generate"); requests++; return new Promise((resolve) => { finish = resolve; }); };
  const { EmailCampaignWizard } = load("app/emailing/EmailCampaignWizard.tsx", {
    "./EmailEditor": { EmailEditor: ({ content }) => React.createElement("div", null, `Aperçu ${content.subject}`) },
    "./EmailSegmentBuilder": { EmailSegmentBuilder: () => React.createElement("div", null, "Ciblage") },
    "@/components/hans-avatar": { HansAvatar: () => React.createElement("span", null, "Hans") }
  });
  const { DEFAULT_EMAIL_CONTENT } = load("lib/emailing-types.ts");
  const unmount = await mount(React.createElement(EmailCampaignWizard, { open: true, merchant: null, subscribers: [], providerReady: false, initialContent: DEFAULT_EMAIL_CONTENT, onClose: () => {}, onCreated: () => {} }));
  try {
    await click("Continuer"); await click("Continuer"); await click("Présenter notre nouveauté de saison");
    await click("Générer avec Hans");
    const modal = document.querySelector('[role="dialog"][aria-label="Hans crée votre e-mail"]');
    assert.ok(modal); assert.equal(modal.getAttribute("aria-busy"), "true"); assert.equal(document.activeElement, modal);
    assert.match(modal.textContent, /couleurs et la police/); assert.equal(document.body.style.overflow, "hidden");
    assert.ok(document.querySelector("[inert]")); assert.equal(requests, 1);
    await act(async () => finish(success ? Response.json({ content: { ...DEFAULT_EMAIL_CONTENT, subject: "Mail de marque", editorMode: "html", html: "<p>Création</p>" } }) : Response.json({ error: "Génération impossible pour le moment" }, { status: 502 })));
    assert.equal(document.querySelector('[role="dialog"]'), null); assert.equal(document.body.style.overflow, "");
    assert.equal(document.querySelector("[inert]"), null);
    assert.match(document.body.textContent, success ? /Aperçu Mail de marque/ : /Génération impossible pour le moment/);
    if (!success) assert.ok(button("Générer avec Hans"));
  } finally { await unmount(); global.fetch = oldFetch; }
});
