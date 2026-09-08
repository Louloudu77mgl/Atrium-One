const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body><div id='editor'></div></body></html>", { url: "https://editor.example.test", pretendToBeVisual: true });
for (const key of ["window", "document", "DOMParser", "Node", "Element", "HTMLElement", "HTMLIFrameElement", "HTMLDivElement", "navigator", "MutationObserver"]) Object.defineProperty(global, key, { configurable: true, value: dom.window[key] });
const grapesjs = require("grapesjs");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports;
  const filename = path.join(root, relative), mod = { exports: {} }; cache.set(relative, mod);
  const js = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename })((id) => id.startsWith("@/") ? load(id.slice(2) + ".ts") : require(id), mod, mod.exports);
  return mod.exports;
}
const { EMAIL_EDITOR_CONFIG, EMAIL_VISUAL_BLOCKS, loadEmailDesign, exportEmailDesign, addEmailBlock, moveEmailElement, duplicateEmailElement, setEmailElementText, setEmailPhoto, uploadEmailPhoto } = load("lib/emailing-visual-editor.ts");
const { normalizeEmailContent } = load("lib/emailing-content.ts");
const { renderEmailHtml } = load("lib/emailing-template.ts");
const html = '<html><head><style>.headline{color:#123456;font-size:28px}@media(max-width:600px){.headline{font-size:22px}}</style></head><body style="background-color:#eeeeee"><table width="600"><tbody><tr><td id="column"><h1 class="headline">Bonjour {{first_name}}</h1><p id="message">Ancien texte</p><a href="https://example.com" id="cta">Découvrir</a><img id="photo" src="https://example.com/original.jpg" alt="Original"></td></tr></tbody></table></body></html>';
function setup(t) {
  const editor = grapesjs.init({ ...EMAIL_EDITOR_CONFIG, headless: true, autorender: false });
  loadEmailDesign(editor, html); t.after(() => editor.destroy()); return editor;
}

// GrapesJS find() uses the rendered canvas; headless tests inspect the actual component model.
function byId(component, id) {
  if (component.getId() === id) return component;
  for (const child of component.components().models) { const found = byId(child, id); if (found) return found; }
}

test("imported HTML exposes editable text, image, links and original styles", (t) => {
  const editor = setup(t), wrapper = editor.getWrapper();
  assert.ok(byId(wrapper, "message")); assert.ok(byId(wrapper, "photo").is("image"));
  const exported = exportEmailDesign(editor);
  assert.match(exported, /background-color: #eeeeee|background-color:#eeeeee/i);
  assert.match(exported, /color:\s*(?:#123456|rgb\(18, 52, 86\))/i); assert.match(exported, /@media/);
});

test("no-code text, button, color and photo edits reach the exported email", (t) => {
  const editor = setup(t), wrapper = editor.getWrapper();
  setEmailElementText(byId(wrapper, "message"), "Nouveau texte\nSans HTML <script>");
  const cta = byId(wrapper, "cta"); setEmailElementText(cta, "Réserver"); cta.addAttributes({ href: "https://example.com/reserver" }); cta.addStyle({ "background-color": "#aa0033", padding: "20px" });
  setEmailPhoto(byId(wrapper, "photo"), "https://example.com/uploaded.jpg", "Photo importée");
  const exported = exportEmailDesign(editor);
  assert.match(exported, /Nouveau texte<br\s*\/>Sans HTML &lt;script&gt;/); assert.match(exported, /reserver/);
  assert.match(exported, /background-color: #aa0033/); assert.match(exported, /padding: 20px/);
  assert.match(exported, /uploaded.jpg/); assert.doesNotMatch(exported, /original.jpg/);
});

test("adding text, photos, buttons and columns keeps valid table structure", (t) => {
  const editor = setup(t), column = byId(editor.getWrapper(), "column");
  for (const block of EMAIL_VISUAL_BLOCKS) {
    const added = addEmailBlock(editor, block.content, column);
    assert.ok(added.parent() === column, block.id);
  }
  const document = new DOMParser().parseFromString(exportEmailDesign(editor), "text/html");
  assert.equal(document.querySelectorAll("table").length, 2);
  assert.match(document.querySelector("#column").textContent, /Première colonne/);
});

test("moving, duplicating, deleting and undo/redo preserve the selected content", (t) => {
  const editor = setup(t), column = byId(editor.getWrapper(), "column"), text = byId(editor.getWrapper(), "message");
  const index = text.index(); moveEmailElement(text, 1); assert.equal(text.index(), index + 1);
  moveEmailElement(text, -1); assert.equal(text.index(), index);
  const clone = duplicateEmailElement(editor, text); assert.equal(clone.index(), text.index() + 1);
  assert.equal(clone.getInnerHTML(), text.getInnerHTML()); const count = column.components().length;
  editor.UndoManager.clear();
  clone.remove(); assert.equal(column.components().length, count - 1);
  editor.UndoManager.undo(); assert.equal(column.components().length, count);
  editor.UndoManager.redo(); assert.equal(column.components().length, count - 1);
});

test("edited designs survive campaign normalization, reopening and actual send rendering", (t) => {
  const first = setup(t); setEmailElementText(byId(first.getWrapper(), "message"), "Modification conservée");
  const content = normalizeEmailContent({ editorMode: "html", html: exportEmailDesign(first), subject: "Test" });
  const second = setup(t); loadEmailDesign(second, JSON.parse(JSON.stringify(content)).html);
  assert.match(exportEmailDesign(second), /Modification conservée/);
  const sent = renderEmailHtml({ campaign: { id: "test", merchant_id: "merchant", content }, merchant: { business_name: "Boutique", city: "Paris", logo_url: null, website_url: null }, recipient: { id: "customer", firstName: "Marie", lastName: "", email: "test@example.test", token: "token" }, origin: "https://app.atrium-one.fr" });
  assert.match(sent, /Bonjour Marie/); assert.match(sent, /Modification conservée/); assert.match(sent, /Se désabonner/);
});

test("photo upload uses existing authenticated endpoint and returns an insertable URL", async () => {
  const file = new File(["image-bytes"], "photo.png", { type: "image/png" });
  const url = await uploadEmailPhoto(file, undefined, async (endpoint, options) => {
    assert.equal(endpoint, "/api/emailing/images"); assert.equal(options.method, "POST");
    assert.equal(options.body.get("image"), file); return Response.json({ url: "https://storage.example.test/photo.png" });
  }); assert.equal(url, "https://storage.example.test/photo.png");
  await assert.rejects(uploadEmailPhoto(new File(["x"], "script.svg", { type: "image/svg+xml" })), /PNG/);
  await assert.rejects(uploadEmailPhoto(file, undefined, async () => Response.json({ error: "Import refusé" }, { status: 401 })), /Import refusé/);
});

test("unsafe imported code is discarded and editor telemetry and external drops are disabled", (t) => {
  const editor = setup(t); loadEmailDesign(editor, '<p onclick="alert(1)">Texte</p><script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(2)">');
  assert.doesNotMatch(exportEmailDesign(editor), /<script|onerror|onclick/);
  assert.equal(EMAIL_EDITOR_CONFIG.telemetry, false); assert.equal(EMAIL_EDITOR_CONFIG.canvas.allowExternalDrop, false);
  assert.equal(editor.StyleManager.getSectors().length, 0);
});

test.after(() => dom.window.close());
