"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import grapesjs, { type Component, type Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import { buttonStyles, fieldStyles } from "@/lib/design-system";
import { addEmailBlock, duplicateEmailElement, EMAIL_EDITOR_CONFIG, EMAIL_VISUAL_BLOCKS, exportEmailDesign, loadEmailDesign, moveEmailElement, setEmailElementText, setEmailPhoto, uploadEmailPhoto } from "@/lib/emailing-visual-editor";
import styles from "./email-no-code.module.css";

type Selection = { name: string; text: string; editableText: boolean; image: boolean; link: boolean; href: string; src: string; alt: string; style: Record<string, string>; removable: boolean };

function selectionState(component?: Component): Selection | null {
  if (!component) return null;
  const tag = component.get("tagName") ?? "";
  const html = component.getInnerHTML().replace(/<br\s*\/?\s*>/gi, "\n");
  const attributes = component.getAttributes();
  const element = component.getEl();
  const computed = element?.ownerDocument.defaultView?.getComputedStyle(element);
  const local = component.getStyle();
  const style: Record<string, string> = {};
  for (const key of ["color", "background-color", "font-size", "font-family", "font-weight", "text-align", "padding", "border-radius", "width"]) style[key] = String(local[key] ?? computed?.getPropertyValue(key) ?? "");
  return { name: component.is("wrapper") ? "Fond de l’e-mail" : ({ img: "Photo", p: "Texte", h1: "Titre", h2: "Titre", a: "Lien / bouton", td: "Colonne", tr: "Ligne", table: "Section", div: "Bloc" }[tag] || "Élément"),
    text: new DOMParser().parseFromString(html, "text/html").body.textContent ?? "",
    editableText: component.is("text") || ["p", "h1", "h2", "h3", "h4", "span", "a", "li"].includes(tag) || (["td", "div"].includes(tag) && !/<(?:table|div|img|h[1-6]|p)\b/i.test(html)),
    image: component.is("image"), link: tag === "a", href: String(attributes.href ?? ""), src: String(attributes.src ?? ""), alt: String(attributes.alt ?? ""), style, removable: !component.is("wrapper") };
}

function hexColor(value: string, fallback: string) {
  if (/^#[a-f\d]{6}$/i.test(value)) return value;
  const rgb = value.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  return rgb ? `#${rgb.slice(1).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}` : fallback;
}

export function EmailNoCodeEditor({ initialHtml, onApply, onClose }: { initialHtml: string; onApply: (html: string) => void; onClose: () => void }) {
  const canvas = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<Component | undefined>(undefined);
  const uploadAbort = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [device, setDevice] = useState("desktop");
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState({ undo: false, redo: false });

  useEffect(() => {
    if (!canvas.current) return;
    const instance = grapesjs.init({ ...EMAIL_EDITOR_CONFIG, container: canvas.current });
    editor.current = instance;
    const refresh = () => {
      setSelection(selectionState(instance.getSelected()));
      setHistory({ undo: instance.UndoManager.hasUndo(), redo: instance.UndoManager.hasRedo() });
    };
    instance.on("canvas:frame:load:head", ({ el, window: frameWindow }) => {
      // The editor needs DOM access, never script execution in user-supplied email HTML.
      el.setAttribute("sandbox", "allow-same-origin");
      el.setAttribute("title", "Design de l’e-mail à modifier");
      el.setAttribute("referrerpolicy", "no-referrer");
      const policy = frameWindow.document.createElement("meta");
      policy.httpEquiv = "Content-Security-Policy";
      policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";
      frameWindow.document.head.prepend(policy);
      frameWindow.document.addEventListener("click", (event) => { if ((event.target as Element).closest?.("a")) event.preventDefault(); }, true);
    });
    instance.on("load", () => {
      loadEmailDesign(instance, initialHtml);
      instance.clearDirtyCount();
      instance.select(instance.getWrapper());
      refresh(); setReady(true);
    });
    // Component collections emit updates mid-mutation. Read the final text once the
    // mutation is complete so controlled fields never restore an earlier value.
    instance.on("component:selected component:deselected component:update component:styleUpdate component:add component:remove update undo redo", () => {
      queueMicrotask(() => { if (editor.current === instance) refresh(); });
    });
    instance.on("asset:custom", ({ open, close }) => {
      if (open) { uploadTarget.current = instance.getSelected(); input.current?.click(); close(); }
    });
    return () => { uploadAbort.current?.abort(); instance.destroy(); editor.current = null; };
  }, [initialHtml]);

  function close() {
    if (!editor.current?.getDirtyCount() || window.confirm("Quitter sans appliquer les modifications du design ?")) onClose();
  }

  function changeStyle(key: string, value: string) {
    editor.current?.getSelected()?.addStyle({ [key]: value });
  }

  function changeAttribute(key: string, value: string) {
    if ((key === "href" && value && !/^(https?:\/\/|mailto:|tel:|#|\{\{unsubscribe_url\}\})/i.test(value))
      || (key === "src" && value && !/^https?:\/\//i.test(value))) { setError("Utilisez une adresse complète, par exemple https://…"); return; }
    setError("");
    const selected = editor.current?.getSelected();
    if (selected && key === "src" && selected.is("image")) setEmailPhoto(selected, value);
    else selected?.addAttributes({ [key]: value });
  }

  function add(id: string) {
    const instance = editor.current;
    const block = EMAIL_VISUAL_BLOCKS.find((item) => item.id === id);
    if (!instance || !block) return;
    const added = addEmailBlock(instance, block.content);
    if (id === "image") { uploadTarget.current = added; input.current?.click(); }
  }

  function pickPhoto() {
    uploadTarget.current = editor.current?.getSelected();
    input.current?.click();
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
    const instance = editor.current;
    if (!file || !instance) return;
    const target = uploadTarget.current;
    const abort = new AbortController(); uploadAbort.current = abort;
    setUploading(true); setError(""); setNotice("");
    try {
      const url = await uploadEmailPhoto(file, abort.signal);
      if (abort.signal.aborted || editor.current !== instance) return;
      const attached = target && (target.is("wrapper") || target.parent());
      const photo = attached && target.is("image") ? target : addEmailBlock(instance, EMAIL_VISUAL_BLOCKS.find((block) => block.id === "image")!.content, attached ? target : instance.getWrapper());
      if (photo) setEmailPhoto(photo, url, file.name.replace(/\.[^.]+$/, ""));
      if (photo) instance.select(photo);
      setNotice("Photo importée. Vous pouvez la redimensionner ou la déplacer.");
    } catch (currentError) {
      if (!abort.signal.aborted) setError(currentError instanceof Error ? currentError.message : "Import impossible.");
    } finally { if (!abort.signal.aborted) setUploading(false); }
  }

  async function apply() {
    const instance = editor.current; if (!instance) return;
    setApplying(true); setError("");
    try {
      // Flush active in-canvas typing, including the last keystroke, before exporting.
      const view = instance.getEditing()?.getView();
      if (view && "syncContent" in view && typeof view.syncContent === "function") await view.syncContent();
      onApply(exportEmailDesign(instance));
    } catch (currentError) { setError(currentError instanceof Error ? currentError.message : "Impossible d’appliquer le design."); }
    finally { setApplying(false); }
  }

  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Éditeur visuel de l’e-mail" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
    <header className={styles.header}>
      <div><h2 className="text-lg font-black text-[#211432]">Modifier le design</h2><p className="text-sm text-[#736A80]">Cliquez sur un élément. Double-cliquez sur un texte pour écrire directement.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonStyles.secondary} onClick={close}>Annuler</button><button type="button" className={`${buttonStyles.primary} disabled:opacity-50`} onClick={() => void apply()} disabled={!ready || uploading || applying}>{applying ? "Application…" : "Appliquer les modifications"}</button></div>
    </header>
    <div className={styles.toolbar}>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonStyles.secondary} disabled={!history.undo} onClick={() => editor.current?.UndoManager.undo()}>↶ Annuler l’action</button><button type="button" className={buttonStyles.secondary} disabled={!history.redo} onClick={() => editor.current?.UndoManager.redo()}>↷ Rétablir</button><button type="button" className={buttonStyles.secondary} disabled={!ready} onClick={() => editor.current?.select(editor.current.getWrapper())}>Fond de l’e-mail</button></div>
      <div className="flex gap-2">{[["desktop", "Ordinateur"], ["mobile", "Mobile"]].map(([id, label]) => <button type="button" key={id} aria-pressed={device === id} className={device === id ? buttonStyles.primary : buttonStyles.secondary} onClick={() => { setDevice(id); editor.current?.setDevice(id); }}>{label}</button>)}</div>
    </div>
    {error ? <p role="alert" className="bg-red-50 px-5 py-2 text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="bg-emerald-50 px-5 py-2 text-sm text-emerald-800">{notice}</p> : null}
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <h3 className="text-sm font-black text-[#211432]">Ajouter un élément</h3>
        <p className="mt-1 text-xs leading-5 text-[#736A80]">Ajout à côté de la sélection, ou dans la colonne sélectionnée. Déplacez ensuite les éléments à la souris.</p>
        <div className="my-3 grid grid-cols-2 gap-2">{EMAIL_VISUAL_BLOCKS.map((block) => <button type="button" key={block.id} disabled={!ready || uploading} onClick={() => add(block.id)} className={buttonStyles.secondary}>+ {block.label}</button>)}</div>
        <button type="button" disabled={!ready || uploading} onClick={pickPhoto} className={`${buttonStyles.primary} w-full disabled:opacity-50`}>{uploading ? "Import de la photo…" : selection?.image ? "Remplacer la photo" : "Importer une photo"}</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Photo à importer" onChange={upload} className="hidden" />
        <p className="mt-2 text-xs text-[#736A80]">PNG, JPG, WEBP ou GIF · 4 Mo maximum</p>
        {selection ? <section className="mt-5 space-y-3 border-t border-[#e8e2ef] pt-4">
          <h3 className="text-sm font-black text-[#211432]">{selection.name}</h3>
          {selection.removable ? <div className="flex flex-wrap gap-2"><button type="button" className={buttonStyles.secondary} onClick={() => { const item = editor.current?.getSelected(); if (item && editor.current) duplicateEmailElement(editor.current, item); }}>Dupliquer</button><button type="button" className={buttonStyles.secondary} onClick={() => { const item = editor.current?.getSelected(); if (item) moveEmailElement(item, -1); }}>↑ Monter</button><button type="button" className={buttonStyles.secondary} onClick={() => { const item = editor.current?.getSelected(); if (item) moveEmailElement(item, 1); }}>↓ Descendre</button><button type="button" className={`${buttonStyles.tertiary} text-red-700`} onClick={() => editor.current?.getSelected()?.remove()}>Supprimer</button></div> : null}
          {selection.editableText ? <label className={styles.field}>Texte<textarea rows={4} className={fieldStyles.input} value={selection.text} onChange={(event) => { const item = editor.current?.getSelected(); if (item) setEmailElementText(item, event.target.value); }} /></label> : null}
          {selection.link ? <label className={styles.field}>Lien du bouton<input key={`link-${editor.current?.getSelected()?.getId()}`} type="url" defaultValue={selection.href} onBlur={(event) => changeAttribute("href", event.target.value)} className={fieldStyles.input} placeholder="https://…" /></label> : null}
          {selection.image ? <><label className={styles.field}>Description de la photo<input value={selection.alt} onChange={(event) => changeAttribute("alt", event.target.value)} className={fieldStyles.input} /></label><label className={styles.field}>Adresse de l’image<input key={`src-${selection.src}`} type="url" defaultValue={selection.src} onBlur={(event) => changeAttribute("src", event.target.value)} className={fieldStyles.input} /></label></> : null}
          <div className="grid grid-cols-2 gap-3">{[["color", "Couleur du texte", "#211432"], ["background-color", "Couleur du fond", "#ffffff"]].map(([key, label, fallback]) => <label key={key} className={styles.field}>{label}<input type="color" value={hexColor(selection.style[key], fallback)} onChange={(event) => changeStyle(key, event.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-[#ded7e8] bg-white p-1" /></label>)}</div>
          <label className={styles.field}>Police<select className={fieldStyles.input} value={selection.style["font-family"]} onChange={(event) => changeStyle("font-family", event.target.value)}><option value={selection.style["font-family"]}>Police actuelle</option><option value="Arial, Helvetica, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="Verdana, sans-serif">Verdana</option></select></label>
          <label className={styles.field}>Alignement<select className={fieldStyles.input} value={selection.style["text-align"] || "left"} onChange={(event) => changeStyle("text-align", event.target.value)}><option value="left">Gauche</option><option value="center">Centré</option><option value="right">Droite</option><option value="start">Automatique</option></select></label>
          <div className="grid grid-cols-2 gap-3">{[["font-size", "Taille du texte", 8, 96], ["padding", "Espacement", 0, 100], ["border-radius", "Arrondis", 0, 100], ["width", "Largeur", 1, 1200]].map(([key, label, min, max]) => <label key={key} className={styles.field}>{label} (px)<input type="number" min={min} max={max} className={fieldStyles.input} value={parseInt(selection.style[String(key)]) || ""} onChange={(event) => { if (event.target.value) changeStyle(String(key), `${Math.min(Number(max), Math.max(Number(min), Number(event.target.value)))}px`); }} /></label>)}</div>
        </section> : <p className="mt-5 text-sm text-[#736A80]">Sélectionnez un texte, une photo ou une section dans l’e-mail.</p>}
      </aside>
      <main className={styles.canvasArea}>{!ready ? <div className={styles.loading} role="status">Ouverture de votre design…</div> : null}<div ref={canvas} className={styles.canvas} /></main>
    </div>
    <footer className="border-t border-[#e8e2ef] bg-white px-5 py-2 text-xs leading-5 text-[#736A80]">Les modifications sont appliquées à votre campagne, puis conservées avec « Enregistrer comme brouillon ». Le lien de désabonnement est ajouté lors de l’envoi.</footer>
  </div>;
}
