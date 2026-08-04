"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";
import { badgeStyles, buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import { DEFAULT_EMAIL_CONTENT, type EmailCampaignContent, type EmailCampaignRecord, type EmailSubscriberProfile } from "@/lib/emailing-types";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";
import { EmailCampaignWizard } from "./EmailCampaignWizard";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

const statusLabels = { draft: "Brouillon", scheduled: "Programmée", sending: "Envoi en cours", sent: "Envoyée", failed: "À vérifier" } as const;

export function EmailingClient({ merchant, brand, subscribers, initialCampaigns, providerReady }: { merchant: MerchantRow | null; brand: MerchantBrandSettingsRow | null; subscribers: EmailSubscriberProfile[]; initialCampaigns: EmailCampaignRecord[]; providerReady: boolean }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaignRecord | null>(null);
  const [notice, setNotice] = useState("");
  const totals = useMemo(() => {
    const sent = campaigns.reduce((sum, campaign) => sum + campaign.sent_count, 0);
    const opens = campaigns.reduce((sum, campaign) => sum + campaign.open_count, 0);
    const clicks = campaigns.reduce((sum, campaign) => sum + campaign.click_count, 0);
    return { sent, openRate: sent ? Math.round((opens / sent) * 1000) / 10 : 0, clickRate: sent ? Math.round((clicks / sent) * 1000) / 10 : 0 };
  }, [campaigns]);
  const latestCampaign = campaigns.find((campaign) => campaign.status === "sent") ?? campaigns[0];
  const scheduledCount = campaigns.filter((campaign) => campaign.status === "scheduled").length;
  const initialContent: EmailCampaignContent = { ...DEFAULT_EMAIL_CONTENT, primaryColor: brand?.primary_color ?? DEFAULT_EMAIL_CONTENT.primaryColor, backgroundColor: brand?.secondary_color ?? DEFAULT_EMAIL_CONTENT.backgroundColor, buttonColor: brand?.accent_color ?? DEFAULT_EMAIL_CONTENT.buttonColor, signature: `À très vite,\nL’équipe ${merchant?.business_name ?? "de votre boutique"}` };

  function created(campaign: EmailCampaignRecord) {
    setCampaigns((current) => [campaign, ...current.filter((item) => item.id !== campaign.id)]);
    setNotice(campaign.status === "sent" ? "Campagne envoyée avec succès." : campaign.status === "scheduled" ? "Campagne programmée." : "Brouillon enregistré.");
    window.setTimeout(() => setNotice(""), 5000);
  }

  function createCampaign() { setEditingCampaign(null); setWizardOpen(true); }
  function editCampaign(campaign: EmailCampaignRecord) { setEditingCampaign(campaign); setWizardOpen(true); }

  const kpis = [
    { label: "Abonnés", value: subscribers.length, detail: "Contacts avec consentement e-mail", icon: "inbox" as const },
    { label: "E-mails envoyés", value: totals.sent, detail: "Toutes campagnes confondues", icon: "mail" as const },
    { label: "Taux d’ouverture", value: `${totals.openRate} %`, detail: "Ouvertures uniques", icon: "chart" as const },
    { label: "Taux de clic", value: `${totals.clickRate} %`, detail: "Clics uniques", icon: "link" as const },
    { label: "Dernière campagne", value: latestCampaign ? formatDate(latestCampaign.sent_at ?? latestCampaign.created_at).split(" à ")[0] : "—", detail: latestCampaign?.name ?? "Aucune campagne", icon: "document" as const },
    { label: "Programmées", value: scheduledCount, detail: "Envoi automatique à venir", icon: "sparkle" as const }
  ];

  return (
    <div className="ao-page-width space-y-6">
      <section className="ao-hero overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><div className={typographyStyles.kicker}>Fidélisation · E-mailing</div><h1 className={`${typographyStyles.h1} mt-2`}>Votre responsable marketing IA</h1><p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#6B617F]">Dites simplement à Hans ce que vous voulez annoncer. Il choisit les bons clients RCU, rédige l’e-mail et prépare l’envoi.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={createCampaign} className={`${buttonStyles.primary} gap-2 px-5 py-3`}><Icon name="mail" className="h-4 w-4" />Créer une campagne</button><Link href="/fidelisation/clients" className={buttonStyles.secondary}>Voir la base clients</Link></div></div>
          <div className="flex min-w-[280px] items-center gap-4 rounded-[22px] border border-[#DCCEF2] bg-white/75 p-4"><HansAvatar size={62} /><div><div className="text-sm font-black text-[#211432]">Hans s’occupe du marketing</div><div className="mt-1 text-xs font-medium leading-5 text-[#6B617F]">Audience, objet, message et optimisation — sans jargon.</div></div></div>
        </div>
      </section>
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">✓ {notice}</div> : null}
      {!providerReady ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"><div><div className="text-sm font-black text-amber-900">Expéditeur à connecter</div><div className="mt-0.5 text-xs font-medium text-amber-800">Vous pouvez créer et enregistrer les campagnes. L’envoi réel s’active avec Resend.</div></div><span className={badgeStyles.warning}>Mode préparation</span></div> : null}
      {subscribers.length === 0 ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#DCCEF2] bg-[#F8F5FF] p-5"><div><div className="text-sm font-black text-[#211432]">Votre liste e-mail démarre avec le RCU</div><p className="mt-1 text-xs font-medium leading-5 text-[#6B617F]">Le formulaire RCU propose désormais un consentement e-mail facultatif. Seuls ces contacts seront ajoutés aux abonnés.</p></div><Link href="/rcu" className={buttonStyles.secondary}>Configurer un RCU</Link></div> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{kpis.map((kpi) => <article key={kpi.label} className={`${surfaceStyles.kpi} min-w-0`}><div className="flex items-start justify-between gap-2"><div className={typographyStyles.kicker}>{kpi.label}</div><Icon name={kpi.icon} className="h-4 w-4 text-[#7C3AED]" /></div><div className="mt-3 truncate text-2xl font-black text-[#211432]">{kpi.value}</div><div className="mt-1 truncate text-[11px] font-medium text-[#83778F]">{kpi.detail}</div></article>)}</section>
      <section className={`${surfaceStyles.section} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDE8F2] px-5 py-4"><div><h2 className={typographyStyles.h2}>Campagnes précédentes</h2><p className="mt-1 text-xs font-medium text-[#7A7188]">Brouillons, campagnes programmées et résultats.</p></div><button type="button" onClick={createCampaign} className={`${buttonStyles.primary} gap-2`}><Icon name="sparkle" className="h-4 w-4" />Nouvelle campagne</button></div>
        {campaigns.length ? <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left"><thead className="bg-[#FBFAFD] text-[10px] font-black uppercase tracking-[0.09em] text-[#8B7AA8]"><tr><th className="px-5 py-3">Nom</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Segment</th><th className="px-4 py-3">Envoyés</th><th className="px-4 py-3">Ouverture</th><th className="px-4 py-3">Clic</th><th className="px-4 py-3">Statut</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#EEEAF3]">{campaigns.map((campaign) => <tr key={campaign.id} className="text-sm hover:bg-[#FBFAFD]"><td className="px-5 py-4"><div className="font-black text-[#211432]">{campaign.name}</div><div className="mt-1 text-[11px] font-medium text-[#8B7AA8]">{campaign.recipient_count} destinataire{campaign.recipient_count > 1 ? "s" : ""}</div></td><td className="px-4 py-4 text-xs font-semibold text-[#6B617F]">{formatDate(campaign.scheduled_at ?? campaign.sent_at ?? campaign.created_at)}</td><td className="max-w-[250px] px-4 py-4 text-xs font-semibold text-[#6B617F]"><span className="line-clamp-2">{campaign.segment_label}</span></td><td className="px-4 py-4 font-black text-[#211432]">{campaign.sent_count}</td><td className="px-4 py-4 font-black text-[#211432]">{campaign.open_rate} %</td><td className="px-4 py-4 font-black text-[#211432]">{campaign.click_rate} %</td><td className="px-4 py-4"><span className={campaign.status === "sent" ? badgeStyles.hans : campaign.status === "failed" ? badgeStyles.danger : campaign.status === "scheduled" ? badgeStyles.warning : badgeStyles.neutral}>{statusLabels[campaign.status]}</span>{campaign.error_message ? <div className="mt-1 max-w-[180px] text-[10px] text-red-600">{campaign.error_message}</div> : null}</td><td className="px-5 py-4">{campaign.status !== "sent" && campaign.status !== "sending" ? <button type="button" onClick={() => editCampaign(campaign)} className={buttonStyles.tertiary}>Reprendre</button> : <span className="text-xs font-semibold text-[#9B91A8]">Terminée</span>}</td></tr>)}</tbody></table></div> : <div className={`${surfaceStyles.empty} m-5 px-5 py-10 text-center`}><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3E8FF] text-[#7C3AED]"><Icon name="mail" className="h-6 w-6" /></div><div className="mt-3 text-sm font-black text-[#211432]">Aucune campagne pour le moment</div><p className="mt-1 text-xs font-medium text-[#7A7188]">Votre première campagne se crée en quelques minutes avec Hans.</p></div>}
      </section>
      <EmailCampaignWizard open={wizardOpen} merchant={merchant} subscribers={subscribers} providerReady={providerReady} initialContent={initialContent} editingCampaign={editingCampaign} onClose={() => setWizardOpen(false)} onCreated={created} />
    </div>
  );
}
