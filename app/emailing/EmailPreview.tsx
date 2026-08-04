"use client";

import type { EmailCampaignContent, EmailSubscriberProfile } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";

function personalize(value: string, subscriber?: EmailSubscriberProfile) {
  return value.replaceAll("{{first_name}}", subscriber?.firstName || "Marie").replaceAll("{{last_name}}", subscriber?.lastName || "");
}

export function EmailPreview({
  content,
  merchant,
  subscriber,
  mobile
}: {
  content: EmailCampaignContent;
  merchant: MerchantRow | null;
  subscriber?: EmailSubscriberProfile;
  mobile: boolean;
}) {
  const businessName = merchant?.business_name ?? "Votre boutique";
  return (
    <div className="rounded-[26px] bg-[#ECE9F3] p-3 sm:p-5">
      <div className={`mx-auto overflow-hidden rounded-[22px] bg-white shadow-[0_18px_45px_rgba(33,20,50,0.14)] transition-all ${mobile ? "max-w-[360px]" : "max-w-[640px]"}`}>
        <div className="border-b border-[#EEEAF3] px-5 py-3 text-[11px] text-[#8B7AA8]"><b className="text-[#211432]">Objet :</b> {personalize(content.subject, subscriber)}<br /><b className="text-[#211432]">Pré-header :</b> {content.preheader}</div>
        <div className="px-6 pb-3 pt-6">
          {content.showLogo && merchant?.logo_url ? <img src={merchant.logo_url} alt={businessName} className="max-h-14 max-w-[180px] object-contain" /> : <div className="text-lg font-black" style={{ color: content.primaryColor }}>{businessName}</div>}
        </div>
        {content.imageUrl ? <img src={content.imageUrl} alt="Visuel de campagne" className="max-h-[300px] w-full object-cover" /> : null}
        <div className="px-6 py-7 sm:px-8">
          <h2 className="text-[28px] font-black leading-[1.15]" style={{ color: content.primaryColor }}>{personalize(content.heading, subscriber)}</h2>
          <div className="mt-5 space-y-4 text-[15px] font-medium leading-7 text-[#51485F]">{personalize(content.body, subscriber).split(/\n{2,}/).map((paragraph, index) => <p key={`${paragraph}-${index}`} className="whitespace-pre-line">{paragraph}</p>)}</div>
          {content.ctaLabel ? <button type="button" className="mt-6 rounded-xl px-5 py-3 text-sm font-black text-white" style={{ backgroundColor: content.buttonColor }}>{content.ctaLabel}</button> : null}
          <p className="mt-7 whitespace-pre-line text-sm font-semibold leading-6 text-[#6B617F]">{personalize(content.signature, subscriber)}</p>
        </div>
        <div className="px-5 py-4 text-center text-[10px] leading-4 text-white" style={{ backgroundColor: content.primaryColor }}>Vous recevez cet e-mail avec votre accord. · <u>Se désabonner</u></div>
      </div>
    </div>
  );
}
