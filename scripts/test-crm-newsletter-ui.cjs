const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Event", "MouseEvent"]) global[key] = key === "window" ? dom.window : key === "document" ? dom.window.document : dom.window[key];
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
const { load } = require("./emailing-test-loader.cjs");
const button = (text) => [...document.querySelectorAll("button")].find((node) => node.textContent.includes(text));
const draft = { title: "Notre newsletter", summary: "Les nouvelles de l’équipe", description: "Le corps à relire", emailSubject: "Bonjour AtriumOne", emailIntro: "Chers utilisateurs" };

for (const success of [true, false]) test(`CRM prompt ${success ? "saves generated content before preview" : "preserves existing content on failure"}`, async () => {
  const previousFetch = global.fetch; const requests = [];
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body); requests.push(url);
    if (url.endsWith("/generate")) return success ? Response.json({ draft }) : Response.json({ error: "IA indisponible" }, { status: 502 });
    if (url === "/api/crm/releases") {
      assert.equal(body.description, draft.description); assert.equal(body.status, "draft"); assert.equal(body.category, "Newsletter");
      assert.deepEqual(body.highlights, []);
      return Response.json({ release: { ...body, id: "new-draft", release_date: body.releaseDate, email_subject: body.emailSubject, email_intro: body.emailIntro } });
    }
    assert.equal(url, "/api/crm/releases/new-draft/preview");
    return Response.json({ html: "<p>Notre newsletter</p>", subject: draft.emailSubject, audienceCount: 1, gmailConnected: false });
  };
  const { ReleasesClient } = load("app/crm/releases/ReleasesClient.tsx", { "next/navigation": { useRouter: () => ({ refresh() {} }) } });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(ReleasesClient, { initialReleases: [{ id: "existing", title: "Release existante", summary: "Résumé existant", description: "Contenu conservé", release_date: "2026-10-07", highlights: ["Ancienne nouveauté"], improvements: [], fixes: [], category: "Produit", status: "draft" }], initialSends: [] })));
    const prompt = document.querySelector("#crm-newsletter-prompt");
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(prompt, "Rédige une newsletter AtriumOne pour nos utilisateurs");
      prompt.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await act(async () => button("Générer un nouveau brouillon").click());
    if (success) {
      assert.ok([...document.querySelectorAll("textarea")].some(node => node.value === draft.description));
      await act(async () => button("Enregistrer et prévisualiser").click());
      assert.deepEqual(requests, ["/api/crm/releases/generate", "/api/crm/releases", "/api/crm/releases/new-draft/preview"]);
      assert.equal(document.querySelector("iframe").getAttribute("sandbox"), "");
      assert.equal(button("Envoyer aux utilisateurs actifs").disabled, true);
    } else {
      assert.ok([...document.querySelectorAll("textarea")].some(node => node.value === "Contenu conservé"));
      assert.match(document.body.textContent, /IA indisponible/);
    }
    assert.ok(!requests.some(url => url.endsWith("/send")));
  } finally { await act(async () => root.unmount()); host.remove(); global.fetch = previousFetch; }
});
