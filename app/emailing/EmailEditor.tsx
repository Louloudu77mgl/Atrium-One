"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { HansGeneratingModal } from "@/components/HansGeneratingModal";
import { buttonStyles, fieldStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import type { EmailCampaignContent, EmailSubscriberProfile } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";
import { EmailPreview } from "./EmailPreview";
import { EmailDesignControls } from "./EmailDesignControls";
import { hasEmailHtmlContent, MAX_EMAIL_HTML_BYTES, sanitizeEmailHtml } from "@/lib/emailing-html";
import { renderEmailHtml } from "@/lib/emailing-template";

const inputClass = fieldStyles.input;

export function EmailEditor({ content, onChange, merchant, sampleSubscriber }: { content: EmailCampaignContent; onChange: (content: EmailCampaignContent) => void; merchant: MerchantRow | null; sampleSubscriber?: EmailSubscriberProfile }) {
  const [mobile, setMobile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [htmlError, setHtmlError] = useState("");
  const [htmlNotice, setHtmlNotice] = useState("");
  const [importingHtml, setImportingHtml] = useState(false);
  const htmlInput = useRef<HTMLInputElement>(null);
  const latestContent = useRef(content);
  latestContent.current = content;
  const htmlMode = content.editorMode === "html";
  const setField = <Key extends keyof EmailCampaignContent>(key: Key, value: EmailCampaignContent[Key]) => onChange({ ...latestContent.current, [key]: value });

  function generatedHtml() {
    return renderEmailHtml({
      campaign: { id: "", merchant_id: merchant?.id ?? "", content: { ...content, editorMode: "visual" } },
      merchant: merchant ?? { business_name: "Votre boutique", city: "", logo_url: null, website_url: null },
      includeFooter: false, preserveVariables: true
    });
  }

  function editHtml() {
    onChange({ ...content, editorMode: "html", html: content.html || generatedHtml() });
    setHtmlError("");
  }

  async function importHtml(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setImportingHtml(true); setHtmlError(""); setHtmlNotice("");
    try {
      if (!/\.html?$/i.test(file.name)) throw new Error("Choisissez un fichier .html ou .htm.");
      if (file.size > MAX_EMAIL_HTML_BYTES) throw new Error("Le fichier HTML doit faire moins de 500 Ko.");
      const raw = await file.text();
      const html = sanitizeEmailHtml(raw);
      if (!hasEmailHtmlContent(html)) throw new Error("Ce fichier ne contient pas de contenu d’e-mail exploitable.");
      if (latestContent.current.html && !window.confirm("Remplacer le code HTML actuel par ce fichier ?")) return;
      onChange({ ...latestContent.current, editorMode: "html", html, htmlFileName: file.name });
      setHtmlNotice(`${file.name} importé. Vous pouvez modifier le code ci-dessous. Les scripts et éléments non adaptés aux e-mails sont retirés.`);
    } catch (error) { setHtmlError(error instanceof Error ? error.message : "Import HTML impossible."); }
    finally { setImportingHtml(false); input.value = ""; }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadError("");
    try {
      const formData = new FormData(); formData.set("image", file);
      const response = await fetch("/api/emailing/images", { method: "POST", body: formData });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Import impossible.");
      setField("imageUrl", payload.url);
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Import impossible."); }
    finally { setUploading(false); event.target.value = ""; }
  }

  async function generateImage() {
    setGeneratingImage(true);
    setUploadError("");
    try {
      const response = await fetch("/api/emailing/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heading: content.heading, body: content.body })
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Génération impossible.");
      setField("imageUrl", payload.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Génération impossible.");
    } finally {
      setGeneratingImage(false);
    }
  }

  return (
    <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DED7E8] bg-[#FBFAFD] p-3">
      <div className="flex flex-wrap gap-2" aria-label="Mode de création de l’e-mail">
        <button type="button" aria-pressed={!htmlMode} onClick={() => setField("editorMode", "visual")} className={!htmlMode ? buttonStyles.primary : buttonStyles.secondary}>Éditeur visuel</button>
        <button type="button" aria-pressed={htmlMode} onClick={editHtml} className={htmlMode ? buttonStyles.primary : buttonStyles.secondary}>Modifier le HTML</button>
      </div>
      <button type="button" onClick={() => htmlInput.current?.click()} disabled={importingHtml} className={`${buttonStyles.secondary} disabled:opacity-50`}>{importingHtml ? "Import en cours…" : "Importer un fichier HTML"}</button>
      <input ref={htmlInput} type="file" accept=".html,.htm,text/html" aria-label="Fichier HTML de l’e-mail" onChange={importHtml} className="hidden" />
    </div>
    {htmlError ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{htmlError}</p> : null}
    {htmlNotice ? <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{htmlNotice}</p> : null}
    <div className={`grid gap-5 ${htmlMode ? "xl:grid-cols-2" : "xl:grid-cols-[390px_minmax(0,1fr)]"}`}>
      <div className={`${surfaceStyles.subtle} space-y-5 p-4 sm:p-5`}>
        <div><div className="inline-flex rounded-full bg-[#F0E8FF] px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#5B2A9E]">{htmlMode ? "Modèle HTML" : "Design modifiable"}</div><div className={`${typographyStyles.h3} mt-3`}>Contenu et design</div><p className={`${typographyStyles.caption} mt-1`}>{htmlMode ? "Modifiez le texte, les liens, les images et les styles directement dans le code." : "Adaptez le contenu et la mise en page du design créé par Hans."}</p></div>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Objet<input value={content.subject} onChange={(event) => setField("subject", event.target.value)} className={inputClass} /></label>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Pré-header<input value={content.preheader} onChange={(event) => setField("preheader", event.target.value)} className={inputClass} /></label>
        {htmlMode ? <>
          {content.htmlFileName ? <p className="break-all text-xs font-semibold text-[#736A80]">Fichier : {content.htmlFileName}</p> : null}
          <label className="grid gap-2 text-sm font-bold text-[#51485F]">Code HTML<textarea rows={26} spellCheck={false} autoCapitalize="off" value={content.html ?? ""} onChange={(event) => setField("html", event.target.value)} className={`${inputClass} min-h-[480px] resize-y whitespace-pre font-mono text-xs font-normal`} /></label>
          <p className="text-xs leading-5 text-[#736A80]">Variables : {"{{first_name}}"}, {"{{last_name}}"} et {"{{unsubscribe_url}}"}. Le lien de désabonnement est aussi ajouté automatiquement à l’envoi. Utilisez des URL HTTPS pour les images ; les fichiers présents uniquement sur votre ordinateur ne sont pas importés.</p>
          <p className="text-xs leading-5 text-[#736A80]">Le HTML et l’éditeur visuel sont conservés séparément. Passer d’un mode à l’autre ne supprime pas votre travail ; seul le mode actif sera envoyé.</p>
          <button type="button" className={`${buttonStyles.tertiary} text-xs`} onClick={() => {
            if (window.confirm("Remplacer le code actuel par le design de l’éditeur visuel ?")) {
              onChange({ ...content, html: generatedHtml(), htmlFileName: "" }); setHtmlNotice("");
            }
          }}>Repartir du design visuel actuel</button>
        </> : <>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Titre<input value={content.heading} onChange={(event) => setField("heading", event.target.value)} className={inputClass} /></label>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Message<textarea rows={9} value={content.body} onChange={(event) => setField("body", event.target.value)} className={`${inputClass} resize-y`} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 text-xs font-black text-[#51485F]">Bouton<input value={content.ctaLabel} onChange={(event) => setField("ctaLabel", event.target.value)} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-black text-[#51485F]">Lien<input type="url" value={content.ctaUrl} onChange={(event) => setField("ctaUrl", event.target.value)} placeholder="https://…" className={inputClass} /></label></div>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Signature<textarea rows={3} value={content.signature} onChange={(event) => setField("signature", event.target.value)} className={inputClass} /></label>
        <div className="overflow-hidden rounded-[20px] border border-[#DED7E8] bg-white">
          {content.imageUrl ? <img src={content.imageUrl} alt="Visuel de campagne" className="h-32 w-full object-cover" /> : <div className="flex h-28 items-center justify-center bg-[linear-gradient(135deg,#F8F5FF,#EEE7FA)] text-xs font-bold text-[#7A7188]">Aucun visuel pour le moment</div>}
          <div className="p-3"><div className="text-xs font-black text-[var(--color-text)]">Visuel de campagne</div><p className="mt-1 text-[11px] font-medium leading-5 text-[#7A7188]">Hans peut générer une image cohérente avec le message et votre charte.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void generateImage()} disabled={generatingImage} className={`${buttonStyles.primary} text-xs disabled:opacity-50`}>{generatingImage ? "Hans crée…" : "Générer avec Hans"}</button><label className={`${buttonStyles.secondary} cursor-pointer text-xs`}>{uploading ? "Import…" : "Importer"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadImage} className="hidden" /></label>{content.imageUrl ? <button type="button" onClick={() => setField("imageUrl", "")} className={`${buttonStyles.tertiary} text-xs`}>Retirer</button> : null}</div>{uploadError ? <p className="mt-2 text-xs font-semibold text-red-600">{uploadError}</p> : null}</div>
        </div>
        <label className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-xs font-black text-[#51485F]">Afficher le logo<input type="checkbox" checked={content.showLogo} onChange={(event) => setField("showLogo", event.target.checked)} className="h-4 w-4 accent-[#7C3AED]" /></label>
        <div className="grid grid-cols-3 gap-2">{(["primaryColor", "backgroundColor", "buttonColor"] as const).map((field, index) => <label key={field} className="grid gap-1 text-[10px] font-bold text-[#7A7188]">{["Titre", "Fond", "Bouton"][index]}<input type="color" value={content[field]} onChange={(event) => setField(field, event.target.value)} className="h-9 w-full cursor-pointer rounded-lg border border-[#DED7E8] bg-white p-1" /></label>)}</div>
        <EmailDesignControls content={content} onChange={onChange} />
        </>}
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-black text-[#211432]">Prévisualisation <span className="rounded-full bg-[#F0E8FF] px-2 py-0.5 text-[9px] uppercase tracking-wide text-[#5B2A9E]">E-mail</span></div><div className="text-xs text-[#7A7188]">Rendu indicatif dans la boîte de réception.</div></div><div className="flex rounded-xl border border-[#E8E2EF] bg-white p-1 text-xs font-black"><button type="button" onClick={() => setMobile(false)} className={`rounded-lg px-3 py-2 ${!mobile ? "bg-[#4C1D95] text-white" : "text-[#6B617F]"}`}>Desktop</button><button type="button" onClick={() => setMobile(true)} className={`rounded-lg px-3 py-2 ${mobile ? "bg-[#4C1D95] text-white" : "text-[#6B617F]"}`}>Mobile</button></div></div>
        <EmailPreview content={content} merchant={merchant} subscriber={sampleSubscriber} mobile={mobile} />
      </div>
    </div>
    <HansGeneratingModal open={generatingImage} title="Hans crée le visuel de l’e-mail" description="Hans traduit votre message en une image professionnelle, cohérente avec votre identité et adaptée au format e-mail." />
    </>
  );
}
