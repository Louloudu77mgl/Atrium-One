"use client";

import { useEffect, useMemo, useState } from "react";
import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";
import { buttonStyles } from "@/lib/design-system";
import { filterEmailSubscribers, getEmailAudiencePreview, getEmailSegmentLabel } from "@/lib/emailing-segments";
import { DEFAULT_EMAIL_CONTENT, EMAIL_CAMPAIGN_TYPE_OPTIONS, type EmailCampaignContent, type EmailCampaignRecord, type EmailCampaignType, type EmailSegmentMode, type EmailSegmentRule, type EmailSubscriberProfile } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";
import { EmailEditor } from "./EmailEditor";
import { EmailSegmentBuilder } from "./EmailSegmentBuilder";

const steps = ["Objectif", "Clients", "Hans", "Finaliser"];

function suggestedRules(type: EmailCampaignType): EmailSegmentRule[] {
  if (type === "reactivation") return [{ id: "absent_days", value: 30 }];
  if (type === "loyalty") return [{ id: "loyal_customers" }];
  if (type === "birthday") return [{ id: "upcoming_birthday" }];
  return [{ id: "all_customers" }];
}

export function EmailCampaignWizard({
  open,
  merchant,
  subscribers,
  providerReady,
  initialContent,
  editingCampaign,
  onClose,
  onCreated
}: {
  open: boolean;
  merchant: MerchantRow | null;
  subscribers: EmailSubscriberProfile[];
  providerReady: boolean;
  initialContent: EmailCampaignContent;
  editingCampaign?: EmailCampaignRecord | null;
  onClose: () => void;
  onCreated: (campaign: EmailCampaignRecord) => void;
}) {
  const [step, setStep] = useState(1);
  const [campaignType, setCampaignType] = useState<EmailCampaignType>("promotion");
  const [name, setName] = useState("");
  const [rules, setRules] = useState<EmailSegmentRule[]>([{ id: "all_customers" }]);
  const [mode, setMode] = useState<EmailSegmentMode>("all");
  const [brief, setBrief] = useState("");
  const [content, setContent] = useState<EmailCampaignContent>(initialContent);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testNotice, setTestNotice] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");
  const audience = useMemo(() => filterEmailSubscribers(subscribers, rules, mode), [subscribers, rules, mode]);
  const audiencePreview = useMemo(() => getEmailAudiencePreview(subscribers, rules, mode), [subscribers, rules, mode]);

  useEffect(() => {
    if (!open) return;
    setStep(editingCampaign ? 4 : 1);
    setCampaignType(editingCampaign?.campaign_type ?? "promotion");
    setName(editingCampaign?.name ?? "");
    setRules(editingCampaign?.segment_rules ?? [{ id: "all_customers" }]);
    setMode(editingCampaign?.segment_mode ?? "all");
    setBrief(editingCampaign?.brief ?? "");
    setContent(editingCampaign?.content ?? initialContent);
    setScheduledAt(editingCampaign?.scheduled_at ? new Date(editingCampaign.scheduled_at).toISOString().slice(0, 16) : "");
    setTestNotice("");
    setError("");
  }, [editingCampaign, initialContent, open]);

  if (!open) return null;

  function selectType(type: EmailCampaignType) {
    setCampaignType(type);
    setRules(suggestedRules(type));
  }

  async function generate() {
    if (!brief.trim()) { setError("Expliquez simplement à Hans ce que vous souhaitez annoncer."); return; }
    setGenerating(true); setError("");
    try {
      const response = await fetch("/api/emailing/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, campaignType, segmentLabel: getEmailSegmentLabel(rules, mode) }) });
      const payload = await response.json() as { content?: EmailCampaignContent; error?: string };
      if (!response.ok || !payload.content) throw new Error(payload.error || "Hans n’a pas pu préparer l’e-mail.");
      setContent({ ...initialContent, ...payload.content });
      setName((current) => current || payload.content!.subject);
      setStep(4);
    } catch (currentError) { setError(currentError instanceof Error ? currentError.message : "Génération impossible."); }
    finally { setGenerating(false); }
  }

  async function save(action: "draft" | "scheduled" | "send") {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/emailing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: editingCampaign?.id, name, campaignType, brief, segmentRules: rules, segmentMode: mode, content, action, scheduledAt: scheduledAt || null })
      });
      const payload = await response.json() as { campaign?: EmailCampaignRecord; error?: string };
      if (!response.ok || !payload.campaign) throw new Error(payload.error || "Impossible d’enregistrer la campagne.");
      onCreated(payload.campaign);
      onClose();
    } catch (currentError) { setError(currentError instanceof Error ? currentError.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  async function sendTest() {
    setTestSending(true);
    setTestNotice("");
    setError("");
    try {
      const response = await fetch("/api/gmail/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Impossible d’envoyer l’aperçu.");
      setTestNotice(payload.message || "Aperçu envoyé à votre adresse Gmail.");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Impossible d’envoyer l’aperçu.");
    } finally {
      setTestSending(false);
    }
  }

  const canContinue = step === 1 ? Boolean(campaignType) : step === 2 ? rules.length > 0 : true;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#211432]/60 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(33,20,50,0.4)]">
        <header className="flex items-center justify-between gap-4 border-b border-[#EDE8F2] px-5 py-4 sm:px-7">
          <div><div className="text-xs font-black uppercase tracking-[0.12em] text-[#7C3AED]">Assistant de campagne</div><h2 className="mt-1 text-xl font-black text-[#211432]">{editingCampaign ? "Reprendre la campagne" : "Hans prépare tout avec vous"}</h2></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F2F8] text-xl font-bold text-[#6B617F]">×</button>
        </header>
        <div className="border-b border-[#EDE8F2] px-5 py-4 sm:px-7"><div className="grid grid-cols-4 gap-2">{steps.map((label, index) => <div key={label} className="min-w-0"><div className={`h-1.5 rounded-full ${step >= index + 1 ? "bg-[#7C3AED]" : "bg-[#E9E4EE]"}`} /><div className={`mt-2 truncate text-[10px] font-black uppercase tracking-wide ${step === index + 1 ? "text-[#4C1D95]" : "text-[#9B91A8]"}`}>{index + 1}. {label}</div></div>)}</div></div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-5 py-6 sm:px-7">
          {step === 1 ? <section><div className="mb-5"><h3 className="text-2xl font-black text-[#211432]">Quel est votre objectif ?</h3><p className="mt-1 text-sm font-medium text-[#736A80]">Choisissez une intention. Hans adaptera ensuite les clients et le message.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{EMAIL_CAMPAIGN_TYPE_OPTIONS.map((option) => <button type="button" key={option.id} onClick={() => selectType(option.id)} className={`rounded-[20px] border p-4 text-left transition ${campaignType === option.id ? "border-[#7C3AED] bg-[#F8F5FF] shadow-md shadow-purple-100" : "border-[#E8E2EF] hover:border-[#C4B5FD]"}`}><span className="text-2xl">{option.emoji}</span><span className="mt-3 block text-sm font-black text-[#211432]">{option.label}</span><span className="mt-1 block text-xs font-medium leading-5 text-[#7A7188]">{option.description}</span></button>)}</div><label className="mt-5 grid max-w-xl gap-1.5 text-xs font-black text-[#51485F]">Nom de la campagne (optionnel)<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Offre rentrée de septembre" className="rounded-xl border border-[#DED7E8] px-4 py-3 text-sm font-medium outline-none focus:border-[#7C3AED]" /></label></section> : null}
          {step === 2 ? <section><div className="mb-5 flex items-start gap-3"><span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3E8FF]"><HansAvatar size={34} /></span><div><h3 className="text-2xl font-black text-[#211432]">À qui l’envoyer ?</h3><p className="mt-1 text-sm font-medium text-[#736A80]">Hans a présélectionné le groupe le plus logique. Combinez les critères avec ET ou OU, sans filtre technique.</p></div></div><EmailSegmentBuilder subscribers={subscribers} rules={rules} mode={mode} onRulesChange={setRules} onModeChange={setMode} /></section> : null}
          {step === 3 ? <section className="mx-auto max-w-3xl"><div className="flex items-center gap-4"><HansAvatar size={58} /><div><div className="text-xs font-black uppercase tracking-[0.12em] text-[#7C3AED]">Parlez à Hans</div><h3 className="mt-1 text-2xl font-black text-[#211432]">Que souhaitez-vous dire ?</h3></div></div><div className="mt-6 rounded-[24px] border border-[#D8C9F1] bg-gradient-to-br from-[#FBF9FF] to-[#F3E8FF] p-5"><textarea autoFocus rows={8} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Ex. Écris un e-mail chaleureux annonçant notre nouvelle collection de pains d’été. Mets en avant les recettes légères et invite les clients à venir les goûter cette semaine." className="w-full resize-y bg-transparent text-base font-medium leading-7 text-[#211432] outline-none placeholder:text-[#9B91A8]" /><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#DCCEF2] pt-4"><div className="text-xs font-semibold text-[#736A80]">Hans créera l’objet, le pré-header, le contenu, le bouton et la signature.</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setStep(4)} className={buttonStyles.tertiary}>Continuer manuellement</button><button type="button" onClick={() => void generate()} disabled={generating} className={`${buttonStyles.primary} gap-2 disabled:opacity-60`}><Icon name="sparkle" className="h-4 w-4" />{generating ? "Hans rédige…" : "Générer avec Hans"}</button></div></div></div><div className="mt-4 flex flex-wrap gap-2">{["Réactiver les clients absents depuis un mois", "Présenter notre nouveauté de saison", "Remercier nos clients les plus fidèles"].map((example) => <button type="button" key={example} onClick={() => setBrief(example)} className="rounded-full border border-[#E1D8EC] bg-white px-3 py-2 text-xs font-bold text-[#6B617F] hover:border-[#A78BFA]">{example}</button>)}</div></section> : null}
          {step === 4 ? <section><div className="mb-5"><h3 className="text-2xl font-black text-[#211432]">Votre campagne est prête</h3><p className="mt-1 text-sm font-medium text-[#736A80]">Modifiez ce que vous voulez, puis choisissez quand l’envoyer à {audience.length} abonné{audience.length > 1 ? "s" : ""}.</p></div><EmailEditor content={content} onChange={setContent} merchant={merchant} sampleSubscriber={audience[0]} /><div className="mt-5 rounded-[22px] border border-[#DCCEF2] bg-[#F8F5FF] p-4"><div className="text-xs font-black uppercase tracking-[0.1em] text-[#7C3AED]">Vos destinataires</div><div className="mt-2 text-sm font-black text-[#211432]">{getEmailSegmentLabel(rules, mode)}</div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#211432]">{audiencePreview.matching.length} client{audiencePreview.matching.length > 1 ? "s" : ""} trouvé{audiencePreview.matching.length > 1 ? "s" : ""}</div><div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#1D6B43]">{audiencePreview.eligible.length} e-mail{audiencePreview.eligible.length > 1 ? "s" : ""} valide{audiencePreview.eligible.length > 1 ? "s" : ""}</div><div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#8A5A12]">{audiencePreview.missingConsent + audiencePreview.missingEmail} exclu{audiencePreview.missingConsent + audiencePreview.missingEmail > 1 ? "s" : ""}</div></div><div className="mt-3 text-xs font-semibold text-[#6B617F]">{audiencePreview.missingConsent} sans consentement · {audiencePreview.missingEmail} sans adresse e-mail valide</div></div><div className="mt-6 rounded-[22px] border border-[#E1D8EC] bg-[#FBFAFD] p-4"><div className="grid gap-4 lg:grid-cols-[1fr_auto]"><label className="grid gap-1.5 text-xs font-black text-[#51485F]">Programmer une date<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="max-w-sm rounded-xl border border-[#DED7E8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#7C3AED]" /></label><div className="flex flex-wrap items-end gap-2"><button type="button" onClick={() => void sendTest()} disabled={testSending || !providerReady} className={`${buttonStyles.tertiary} disabled:cursor-not-allowed disabled:opacity-45`}>{testSending ? "Envoi du test…" : "M’envoyer un test"}</button><button type="button" onClick={() => void save("draft")} disabled={saving} className={buttonStyles.secondary}>Enregistrer comme brouillon</button><button type="button" onClick={() => void save("scheduled")} disabled={saving || !scheduledAt || !providerReady || audience.length === 0} className={`${buttonStyles.secondary} disabled:cursor-not-allowed disabled:opacity-45`}>Programmer</button><button type="button" onClick={() => void save("send")} disabled={saving || !providerReady || audience.length === 0} className={`${buttonStyles.primary} gap-2 disabled:opacity-45`}><Icon name="mail" className="h-4 w-4" />{saving ? "Traitement…" : `Envoyer à ${audience.length} client${audience.length > 1 ? "s" : ""}`}</button></div></div>{!providerReady ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Connectez Gmail pour programmer ou envoyer réellement cette campagne. Le brouillon peut déjà être enregistré.</p> : audience.length === 0 ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Aucun client éligible ne correspond à ce ciblage.</p> : null}{testNotice ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">✓ {testNotice}</p> : null}</div></section> : null}
          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[#EDE8F2] px-5 py-4 sm:px-7"><button type="button" onClick={() => step === 1 ? onClose() : setStep((current) => current - 1)} className={buttonStyles.tertiary}>{step === 1 ? "Annuler" : "← Retour"}</button>{step < 3 ? <button type="button" onClick={() => canContinue && setStep((current) => current + 1)} disabled={!canContinue} className={`${buttonStyles.primary} disabled:opacity-50`}>Continuer →</button> : step === 3 ? <span className="text-xs font-semibold text-[#8B7AA8]">Hans vous laisse la main sur chaque détail.</span> : <button type="button" onClick={() => setStep(3)} className={buttonStyles.tertiary}>Demander une autre version à Hans</button>}</footer>
      </div>
    </div>
  );
}
