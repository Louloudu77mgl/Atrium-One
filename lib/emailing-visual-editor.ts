import type { Component, Editor, EditorConfig } from "grapesjs";
import juice from "juice";
import { sanitizeEmailHtml } from "@/lib/emailing-html";

export const EMAIL_VISUAL_BLOCKS = [
  { id: "heading", label: "Titre", content: '<h2 style="margin:16px 0;font-family:Arial,sans-serif;font-size:28px;color:#4c1d95">Votre titre</h2>' },
  { id: "text", label: "Texte", content: '<p style="margin:16px 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#51485f">Écrivez votre texte ici.</p>' },
  { id: "button", label: "Bouton", content: '<a href="https://example.com" style="display:inline-block;margin:16px 0;padding:14px 24px;background-color:#7c3aed;color:#ffffff;border-radius:8px;font-family:Arial,sans-serif;text-decoration:none">Découvrir</a>' },
  { id: "image", label: "Photo", content: '<img alt="Votre photo" style="display:block;max-width:100%;width:320px;height:auto;margin:16px 0">' },
  { id: "divider", label: "Séparateur", content: '<hr style="border:0;border-top:1px solid #ddd;margin:24px 0">' },
  { id: "spacer", label: "Espacement", content: '<div style="height:32px;line-height:32px">&nbsp;</div>' },
  { id: "columns", label: "Deux colonnes", content: '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:16px 0"><tbody><tr><td width="50%" style="width:50%;padding:16px;vertical-align:top"><p style="font:16px Arial,sans-serif">Première colonne</p></td><td width="50%" style="width:50%;padding:16px;vertical-align:top"><p style="font:16px Arial,sans-serif">Deuxième colonne</p></td></tr></tbody></table>' }
] as const;

export const EMAIL_EDITOR_CONFIG: EditorConfig = {
  storageManager: false, telemetry: false, noticeOnUnload: false,
  height: "100%", width: "auto", panels: { defaults: [] },
  // Styling is provided by our React controls. Disable the unused default
  // sectors, whose number parsers reject some imported email shorthand values.
  styleManager: { sectors: [] },
  protectedCss: "", baseCss: "", multipleSelection: false,
  parser: { optionsHtml: { allowScripts: false, allowUnsafeAttr: false, allowUnsafeAttrValue: false } },
  canvas: { scripts: [], styles: [], allowExternalDrop: false },
  assetManager: { custom: true, upload: false },
  deviceManager: { devices: [{ id: "desktop", name: "Ordinateur", width: "" }, { id: "mobile", name: "Mobile", width: "375px", widthMedia: "" }] }
};

export function loadEmailDesign(editor: Editor, html: string) {
  const document = new DOMParser().parseFromString(sanitizeEmailHtml(html), "text/html");
  const css = Array.from(document.querySelectorAll("style")).map((style) => style.textContent ?? "").join("\n");
  document.querySelectorAll("style").forEach((style) => style.remove());
  // Set stylesheet first: parsing components creates additional rules for inline styles.
  editor.setStyle(css);
  editor.setComponents(document.body.innerHTML);
  const attributes = Object.fromEntries(Array.from(document.body.attributes).map((attr) => [attr.name, attr.value]));
  editor.getWrapper()?.addAttributes(attributes);
  editor.UndoManager.clear();
}

export function exportEmailDesign(editor: Editor) {
  const body = editor.getHtml();
  const css = editor.getCss({ keepUnusedStyles: true }) ?? "";
  const document = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}</style></head>${/<body\b/i.test(body) ? body : `<body>${body}</body>`}</html>`;
  // Inline styles for mail clients; retain media queries for responsive templates. No resource fetching.
  return sanitizeEmailHtml(juice(sanitizeEmailHtml(document), { preserveMediaQueries: true, removeStyleTags: false, applyWidthAttributes: true, applyHeightAttributes: true }));
}

function isContentContainer(component: Component) {
  return component.is("wrapper") || ["td", "th", "body"].includes(component.get("tagName") ?? "")
    || (component.get("tagName") === "div" && !component.is("text"));
}

export function addEmailBlock(editor: Editor, html: string, target = editor.getSelected()) {
  let parent = target;
  let after = target;
  while (parent && !isContentContainer(parent)) { after = parent; parent = parent.parent(); }
  parent ??= editor.getWrapper();
  if (!parent) throw new Error("Sélectionnez un emplacement dans l’e-mail.");
  const at = after && after !== parent && after.parent() === parent ? after.index() + 1 : parent.components().length;
  const added = parent.append(html, { at })[0];
  if (added) editor.select(added);
  return added;
}

export function moveEmailElement(component: Component, direction: -1 | 1) {
  const parent = component.parent();
  if (!parent) return;
  const index = component.index();
  const next = index + direction;
  if (next < 0 || next >= parent.components().length) return;
  component.move(parent, { at: direction > 0 ? next + 1 : next });
}

export function duplicateEmailElement(editor: Editor, component: Component) {
  const parent = component.parent();
  if (!parent) return;
  const copy = parent.append(component.clone(), { at: component.index() + 1 })[0];
  if (copy) editor.select(copy);
  return copy;
}

export function setEmailElementText(component: Component, text: string) {
  const safe = text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  component.components(safe.replaceAll("\n", "<br>"));
}

export function setEmailPhoto(component: Component, url: string, alt?: string) {
  // Image components own their src property; an HTML attribute alone is ignored on export.
  component.set("src", url);
  if (alt !== undefined) component.addAttributes({ alt });
}

export async function uploadEmailPhoto(file: File, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || !file.size || file.size > 4 * 1024 * 1024) {
    throw new Error("Choisissez une photo PNG, JPG, WEBP ou GIF de moins de 4 Mo.");
  }
  const form = new FormData(); form.set("image", file);
  const response = await fetcher("/api/emailing/images", { method: "POST", body: form, signal });
  const payload = await response.json().catch(() => null) as { url?: string; error?: string } | null;
  if (!response.ok || !payload?.url || !/^https?:\/\//i.test(payload.url)) throw new Error(payload?.error || "Import de la photo impossible. Réessayez avec une image de moins de 4 Mo.");
  return payload.url;
}
