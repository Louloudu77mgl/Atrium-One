"use client";

import { useState, type ChangeEvent } from "react";
import { buttonStyles } from "@/lib/design-system";
import type { EmailCampaignContent, EmailSubscriberProfile } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";
import { EmailPreview } from "./EmailPreview";

const inputClass = "w-full rounded-xl border border-[#DED7E8] bg-white px-3.5 py-2.5 text-sm font-medium text-[#211432] outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#EDE9FE]";

export function EmailEditor({ content, onChange, merchant, sampleSubscriber }: { content: EmailCampaignContent; onChange: (content: EmailCampaignContent) => void; merchant: MerchantRow | null; sampleSubscriber?: EmailSubscriberProfile }) {
  const [mobile, setMobile] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4 rounded-[24px] border border-[#E8E2EF] bg-[#FBFAFD] p-4">
        <div><div className="text-sm font-black text-[#211432]">Contenu</div><p className="mt-1 text-xs text-[#7A7188]">Tout reste modifiable. Hans a simplement préparé la première version.</p></div>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Objet<input value={content.subject} onChange={(event) => setField("subject", event.target.value)} className={inputClass} /></label>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Pré-header<input value={content.preheader} onChange={(event) => setField("preheader", event.target.value)} className={inputClass} /></label>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Titre<input value={content.heading} onChange={(event) => setField("heading", event.target.value)} className={inputClass} /></label>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Message<textarea rows={9} value={content.body} onChange={(event) => setField("body", event.target.value)} className={`${inputClass} resize-y`} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 text-xs font-black text-[#51485F]">Bouton<input value={content.ctaLabel} onChange={(event) => setField("ctaLabel", event.target.value)} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-black text-[#51485F]">Lien<input type="url" value={content.ctaUrl} onChange={(event) => setField("ctaUrl", event.target.value)} placeholder="https://…" className={inputClass} /></label></div>
        <label className="grid gap-1.5 text-xs font-black text-[#51485F]">Signature<textarea rows={3} value={content.signature} onChange={(event) => setField("signature", event.target.value)} className={inputClass} /></label>
        <div className="rounded-2xl border border-[#E8E2EF] bg-white p-3"><div className="text-xs font-black text-[#51485F]">Image de campagne</div><div className="mt-2 flex flex-wrap gap-2"><label className={`${buttonStyles.secondary} cursor-pointer text-xs`}>{uploading ? "Import…" : "Ajouter une image"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadImage} className="hidden" /></label>{content.imageUrl ? <button type="button" onClick={() => setField("imageUrl", "")} className={`${buttonStyles.tertiary} text-xs`}>Retirer</button> : null}</div>{uploadError ? <p className="mt-2 text-xs font-semibold text-red-600">{uploadError}</p> : null}</div>
        <label className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-xs font-black text-[#51485F]">Afficher le logo<input type="checkbox" checked={content.showLogo} onChange={(event) => setField("showLogo", event.target.checked)} className="h-4 w-4 accent-[#7C3AED]" /></label>
        <div className="grid grid-cols-3 gap-2">{(["primaryColor", "backgroundColor", "buttonColor"] as const).map((field, index) => <label key={field} className="grid gap-1 text-[10px] font-bold text-[#7A7188]">{["Titre", "Fond", "Bouton"][index]}<input type="color" value={content[field]} onChange={(event) => setField(field, event.target.value)} className="h-9 w-full cursor-pointer rounded-lg border border-[#DED7E8] bg-white p-1" /></label>)}</div>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-sm font-black text-[#211432]">Prévisualisation</div><div className="text-xs text-[#7A7188]">Rendu indicatif dans la boîte de réception.</div></div><div className="flex rounded-xl border border-[#E8E2EF] bg-white p-1 text-xs font-black"><button type="button" onClick={() => setMobile(false)} className={`rounded-lg px-3 py-2 ${!mobile ? "bg-[#4C1D95] text-white" : "text-[#6B617F]"}`}>Desktop</button><button type="button" onClick={() => setMobile(true)} className={`rounded-lg px-3 py-2 ${mobile ? "bg-[#4C1D95] text-white" : "text-[#6B617F]"}`}>Mobile</button></div></div>
        <EmailPreview content={content} merchant={merchant} subscriber={sampleSubscriber} mobile={mobile} />
      </div>
    </div>
  );
}
