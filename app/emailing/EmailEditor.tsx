"use client";

import { useState, type ChangeEvent } from "react";
import { HansGeneratingModal } from "@/components/HansGeneratingModal";
import { buttonStyles, fieldStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import type { EmailCampaignContent, EmailSubscriberProfile } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";
import { EmailPreview } from "./EmailPreview";

const inputClass = fieldStyles.input;

export function EmailEditor({ content, onChange, merchant, sampleSubscriber }: { content: EmailCampaignContent; onChange: (content: EmailCampaignContent) => void; merchant: MerchantRow | null; sampleSubscriber?: EmailSubscriberProfile }) {
  const [mobile, setMobile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const setField = <Key extends keyof EmailCampaignContent>(key: Key, value: EmailCampaignContent[Key]) => onChange({ ...content, [key]: value });

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
    <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <div className={`${surfaceStyles.subtle} space-y-5 p-4 sm:p-5`}>
        <div><div className="inline-flex rounded-full bg-[#F0E8FF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#5B2A9E]">E-mail · hauteur automatique</div><div className={`${typographyStyles.h3} mt-3`}>Contenu et design</div><p className={`${typographyStyles.caption} mt-1`}>Le message s’allonge naturellement avec votre texte. Chaque élément reste modifiable.</p></div>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Objet<input value={content.subject} onChange={(event) => setField("subject", event.target.value)} className={inputClass} /></label>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Pré-header<input value={content.preheader} onChange={(event) => setField("preheader", event.target.value)} className={inputClass} /></label>
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
