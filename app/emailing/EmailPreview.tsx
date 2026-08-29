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
    <div className="rounded-[26px] bg-[linear-gradient(145deg,#ECE9F3,#F8F6FB)] p-3 sm:p-5">
      <div className={`mx-auto overflow-hidden rounded-[24px] bg-white shadow-[0_22px_60px_rgba(33,20,50,0.14)] transition-all ${mobile ? "max-w-[360px]" : "max-w-[640px]"}`}>
        <div className="h-2" style={{ background: `linear-gradient(90deg, ${content.primaryColor}, ${content.buttonColor})` }} />
        <div className="border-b border-[#EEEAF3] bg-[#FCFBFD] px-5 py-3 text-[11px] leading-5 text-[#8B7AA8]"><b className="text-[#211432]">Objet :</b> {personalize(content.subject, subscriber)}<br /><b className="text-[#211432]">Pré-header :</b> {content.preheader}</div>
        <div className="flex items-center justify-between gap-4 px-6 pb-4 pt-6">
          {content.showLogo && merchant?.logo_url ? <img src={merchant.logo_url} alt={businessName} className="max-h-14 max-w-[180px] object-contain" /> : <div className="text-lg font-black" style={{ color: content.primaryColor }}>{businessName}</div>}
          <span className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em]" style={{ backgroundColor: content.backgroundColor, color: content.primaryColor }}>Actualité</span>
        </div>
        {content.imageUrl ? <div className="px-4 sm:px-6"><img src={content.imageUrl} alt="Visuel de campagne" className="max-h-[320px] w-full rounded-[18px] object-cover" /></div> : null}
        <div className="px-6 py-8 sm:px-9">
          <div className="mb-4 h-1 w-12 rounded-full" style={{ backgroundColor: content.buttonColor }} />
          <h2 className="text-[30px] font-black leading-[1.12] tracking-[-0.03em]" style={{ color: content.primaryColor }}>{personalize(content.heading, subscriber)}</h2>
          <div className="mt-5 space-y-4 text-[15px] font-medium leading-7 text-[#51485F]">{personalize(content.body, subscriber).split(/\n{2,}/).map((paragraph, index) => <p key={`${paragraph}-${index}`} className="whitespace-pre-line">{paragraph}</p>)}</div>
          {content.ctaLabel ? <button type="button" className="mt-7 rounded-xl px-6 py-3.5 text-sm font-black text-white shadow-sm" style={{ backgroundColor: content.buttonColor }}>{content.ctaLabel}</button> : null}
          <p className="mt-8 whitespace-pre-line border-t border-[#EEEAF3] pt-6 text-sm font-semibold leading-6 text-[#6B617F]">{personalize(content.signature, subscriber)}</p>
        </div>
        <div className="px-5 py-4 text-center text-[10px] leading-4 text-white" style={{ backgroundColor: content.primaryColor }}>Vous recevez cet e-mail avec votre accord. · <u>Se désabonner</u></div>
      </div>
    </div>
  );
}
