"use client";

import Link from "next/link";
import { useState } from "react";
import { PRE_ONBOARDING_STATUSES, type CrmPreOnboarding, type PreOnboardingStatus } from "@/lib/crm/pre-onboarding";

type Lead = { id: string; name: string; city: string | null; commercial_status: string };
type Row = CrmPreOnboarding & { crm_leads: Lead | Lead[] | null };

export function PreOnboardingsWorkspace({ initial, publicPath, loadError }: { initial: Row[]; publicPath: string; loadError: string | null }) {
  const [rows, setRows] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(initial[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);

  async function copy(value: string, label = "Valeur") {
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copié.`); window.setTimeout(() => setMessage(null), 1800);
  }
  async function patch(id: string, changes: Partial<CrmPreOnboarding>) {
    const response = await fetch(`/api/crm/pre-onboardings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(changes) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(payload.error?.message ?? "Modification impossible."); return; }
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...payload } : row));
  }

  const publicUrl = typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`;
  return <div>
    <header className="border-b border-[#E8E4DB] bg-white px-5 py-5 lg:px-8">
      <div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B7AA8]">Préparation des tests</div>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black tracking-[-.03em]">Pré-onboardings</h1><p className="mt-1 text-sm font-semibold text-[#6B617F]">Les informations Google Business, Gmail et Instagram transmises par vos clients.</p></div><div className="flex gap-2"><button onClick={() => void copy(publicUrl, "Lien du formulaire")} className="ao-btn-secondary px-4 py-2.5 text-xs font-black">Copier le lien du formulaire</button><a href={publicPath} target="_blank" rel="noreferrer" className="ao-btn-primary px-4 py-2.5 text-xs font-black">Ouvrir le formulaire ↗</a></div></div>
      {message ? <div className="mt-3 rounded-lg bg-[#F3E8FF] px-3 py-2 text-xs font-black text-[#4C1D95]">{message}</div> : null}
      {loadError ? <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">{loadError}</div> : null}
    </header>
    <main className="p-5 lg:p-8">
      <div className="mb-4 grid gap-3 sm:grid-cols-3"><Metric label="À configurer" value={rows.filter((row) => row.status === "À configurer").length} /><Metric label="En cours" value={rows.filter((row) => row.status === "En cours").length} /><Metric label="Terminés" value={rows.filter((row) => row.status === "Terminé").length} green /></div>
      <div className="space-y-3">{rows.map((row) => { const lead = Array.isArray(row.crm_leads) ? row.crm_leads[0] : row.crm_leads; const expanded = openId === row.id; return <article key={row.id} className="overflow-hidden rounded-xl border border-[#E8E4DB] bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 py-4">
          <button type="button" onClick={() => setOpenId(expanded ? null : row.id)} className="min-w-0 flex-1 text-left"><div className="truncate text-sm font-black">{row.business_name}</div><div className="mt-1 text-[11px] font-semibold text-[#8B7AA8]">{row.manager_name} · {new Date(row.submitted_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</div></button>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${row.status === "Terminé" ? "bg-emerald-100 text-emerald-700" : row.status === "En cours" ? "bg-amber-100 text-amber-800" : "bg-[#F3E8FF] text-[#6D28D9]"}`}>{row.status}</span>
          <select aria-label="Statut du pré-onboarding" value={row.status} onChange={(event) => void patch(row.id, { status: event.target.value as PreOnboardingStatus })} className="ao-select h-9 px-2 text-xs font-black">{PRE_ONBOARDING_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
          {lead ? <Link href={`/crm/leads/${lead.id}`} className="ao-btn-secondary px-3 py-2 text-xs font-black">Fiche client</Link> : null}
          <button type="button" onClick={() => setOpenId(expanded ? null : row.id)} className="px-2 text-xs font-black text-[#6D28D9]">{expanded ? "Masquer" : "Voir les réponses au form"}</button>
        </div>
        {expanded ? <div className="border-t border-[#EEEAE2] bg-[#FCFBF8] p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <AnswerCard title="Google Business" configured={row.google_configured} onConfigured={(value) => void patch(row.id, { google_configured: value })} rows={[["E-mail", row.google_business_email]]} onCopy={copy} />
            <AnswerCard title="Gmail" configured={row.gmail_configured} onConfigured={(value) => void patch(row.id, { gmail_configured: value })} rows={[["E-mail", row.gmail_email], ["Même compte Google", row.gmail_same_as_google ? "Oui" : "Non"]]} onCopy={copy} />
            <AnswerCard title="Instagram" configured={row.instagram_configured} onConfigured={(value) => void patch(row.id, { instagram_configured: value })} rows={[["Nom", row.instagram_business_name], ["Identifiant", `@${row.instagram_handle}`]]} onCopy={copy} />
          </div>
          <div className="mt-4 grid gap-3 rounded-xl border border-[#E8E4DB] bg-white p-4 sm:grid-cols-3"><Value label="Commerce" value={row.business_name} /><Value label="Responsable" value={row.manager_name} /><Value label="E-mail de contact" value={row.contact_email} /></div>
          {row.notification_status !== "sent" ? <p className="mt-3 text-[11px] font-bold text-amber-700">Notification e-mail : {row.notification_status === "failed" ? "échec d’envoi" : "Gmail CRM non connecté"}. La réponse reste bien enregistrée.</p> : null}
        </div> : null}
      </article>; })}{!rows.length && !loadError ? <div className="rounded-xl border border-dashed border-[#D9D1C3] bg-white p-10 text-center"><div className="text-sm font-black">Aucune réponse pour le moment</div><p className="mt-1 text-xs font-semibold text-[#8B7AA8]">Copiez le lien du formulaire et envoyez-le à votre prochain client test.</p></div> : null}</div>
    </main>
  </div>;
}

function Metric({ label, value, green = false }: { label: string; value: number; green?: boolean }) { return <div className="rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm"><div className={`text-2xl font-black ${green ? "text-emerald-600" : "text-[#6D28D9]"}`}>{value}</div><div className="text-[10px] font-black uppercase tracking-wide text-[#8B7AA8]">{label}</div></div>; }
function AnswerCard({ title, configured, onConfigured, rows, onCopy }: { title: string; configured: boolean; onConfigured: (value: boolean) => void; rows: string[][]; onCopy: (value: string, label?: string) => Promise<void> }) { return <section className="rounded-xl border border-[#E8E4DB] bg-white p-4"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-black">{title}</h2><label className="flex items-center gap-2 text-[10px] font-black text-[#5F5472]"><input type="checkbox" checked={configured} onChange={(event) => onConfigured(event.target.checked)} />Configuré</label></div><div className="space-y-3">{rows.map(([label, value]) => <div key={label}><div className="text-[9px] font-black uppercase tracking-wide text-[#8B7AA8]">{label}</div><div className="mt-0.5 flex items-center gap-2"><span className="min-w-0 flex-1 break-all text-xs font-bold">{value}</span><button onClick={() => void onCopy(value, label)} className="text-[10px] font-black text-[#6D28D9]">Copier</button></div></div>)}</div></section>; }
function Value({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] font-black uppercase tracking-wide text-[#8B7AA8]">{label}</div><div className="mt-1 break-all text-xs font-black">{value}</div></div>; }
