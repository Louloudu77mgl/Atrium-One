"use client";

import { useDeferredValue, useMemo } from "react";
import { isolatedEmailPreview } from "@/lib/emailing-html";
import { personalizeEmailText, renderEmailHtml } from "@/lib/emailing-template";
import type { EmailCampaignContent, EmailSubscriberProfile } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";

export function EmailPreview({ content, merchant, subscriber, mobile }: {
  content: EmailCampaignContent;
  merchant: MerchantRow | null;
  subscriber?: EmailSubscriberProfile;
  mobile: boolean;
}) {
  const deferred = useDeferredValue(content);
  const preview = useMemo(() => {
    try {
      return { html: isolatedEmailPreview(renderEmailHtml({
        campaign: { id: "preview", merchant_id: merchant?.id ?? "", content: deferred },
        merchant: merchant ?? { business_name: "Votre boutique", city: "", logo_url: null, website_url: null },
        recipient: { id: "preview", token: "", email: "", firstName: subscriber?.firstName || "Marie", lastName: subscriber?.lastName || "" }
      })), error: "" };
    } catch (error) {
      return { html: "", error: error instanceof Error ? error.message : "Aperçu indisponible." };
    }
  }, [deferred, merchant, subscriber]);

  return (
    <div className="rounded-[26px] bg-[#ECE9F3] p-3 sm:p-4">
      <div className={`mx-auto overflow-hidden rounded-2xl bg-white shadow-lg transition-all ${mobile ? "max-w-[375px]" : "w-full"}`}>
        <div className="border-b border-[#EEEAF3] bg-[#FCFBFD] px-4 py-3 text-xs leading-5 text-[#736A80]"><b className="text-[#211432]">Objet :</b> {personalizeEmailText(content.subject, subscriber ?? { firstName: "Marie", lastName: "" })}<br /><b className="text-[#211432]">Pré-header :</b> {content.preheader}</div>
        {preview.error ? <p role="alert" className="p-5 text-sm text-red-700">{preview.error}</p> : <iframe title={mobile ? "Aperçu mobile de l’e-mail" : "Aperçu de l’e-mail"} srcDoc={preview.html} sandbox="" referrerPolicy="no-referrer" className="h-[720px] w-full border-0 bg-white" />}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#6B617F]">Le même HTML est utilisé pour l’envoi. Le rendu peut varier selon la messagerie. Les liens sont désactivés dans cet aperçu.</p>
    </div>
  );
}
