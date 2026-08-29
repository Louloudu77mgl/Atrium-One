"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COMMERCIAL_STATUSES, type CrmLead, type CrmTask, type CrmAppointment, type BusinessAccess } from "@/lib/crm/types";

type LeadRow = CrmLead & { next_task: CrmTask | null; next_appointment: CrmAppointment | null; account_access: BusinessAccess | null; last_interaction: string | null };
type Presence = "all" | "yes" | "no";
const dateLabel = (value?: string | null) => value ? new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—";

export function LeadsWorkspace({ initialLeads }: { initialLeads: LeadRow[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ city: "", businessType: "", status: "", minRating: "", minReviews: "", phone: "all" as Presence, email: "all" as Presence, website: "all" as Presence, account: "all" as Presence, enabled: "all" as Presence, appointment: "all" as Presence, task: "all" as Presence, addedAfter: "" });
  const [sort, setSort] = useState("created_desc");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const cities = [...new Set(leads.map((lead) => lead.city).filter(Boolean))].sort() as string[];
  const types = [...new Set(leads.map((lead) => lead.business_type).filter(Boolean))].sort() as string[];

  const visible = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    const has = (value: unknown, mode: Presence) => mode === "all" || (mode === "yes" ? Boolean(value) : !value);
    const rows = leads.filter((lead) => {
      const haystack = [lead.name, lead.city, lead.business_type, lead.email, lead.phone, lead.address].join(" ").toLowerCase();
      return (!normalized || haystack.includes(normalized)) && (!filters.city || lead.city === filters.city) && (!filters.businessType || lead.business_type === filters.businessType) && (!filters.status || lead.commercial_status === filters.status)
        && (!filters.minRating || (lead.google_rating ?? 0) >= Number(filters.minRating)) && (!filters.minReviews || (lead.google_reviews_count ?? 0) >= Number(filters.minReviews))
        && has(lead.phone, filters.phone) && has(lead.email, filters.email) && has(lead.website, filters.website) && has(lead.business_id, filters.account)
        && has(lead.account_access?.account_enabled, filters.enabled) && has(lead.next_appointment, filters.appointment) && has(lead.next_task, filters.task)
        && (!filters.addedAfter || lead.created_at.slice(0, 10) >= filters.addedAfter);
    });
    return rows.sort((a, b) => {
      if (sort === "reviews_desc") return (b.google_reviews_count ?? -1) - (a.google_reviews_count ?? -1);
      if (sort === "rating_desc") return (b.google_rating ?? -1) - (a.google_rating ?? -1);
      if (sort === "city") return (a.city ?? "").localeCompare(b.city ?? "", "fr");
      if (sort === "status") return a.commercial_status.localeCompare(b.commercial_status, "fr");
      if (sort === "task") return (a.next_task?.due_date ?? "9999").localeCompare(b.next_task?.due_date ?? "9999");
      if (sort === "appointment") return (a.next_appointment?.appointment_date ?? "9999").localeCompare(b.next_appointment?.appointment_date ?? "9999");
      return b.created_at.localeCompare(a.created_at);
    });
  }, [leads, query, filters, sort]);

  async function updateLead(id: string, update: Record<string, unknown>) {
    setBusyId(id); const response = await fetch(`/api/crm/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) });
    if (response.ok) { const data = await response.json(); setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, ...data } : lead)); } setBusyId(null);
  }

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
    const response = await fetch("/api/crm/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json(); if (response.ok) router.push(`/crm/leads/${data.id}`);
  }

  return <div className="space-y-4 p-5 lg:p-8">
    <div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un prospect..." className="ao-input h-10 min-w-[250px] flex-1 px-3 text-sm font-semibold" /><button onClick={() => setShowFilters(!showFilters)} className="ao-btn-secondary px-3.5 text-xs font-black">Filtres</button><select value={sort} onChange={(event) => setSort(event.target.value)} className="ao-select h-10 px-3 text-xs font-bold"><option value="created_desc">Ajout récent</option><option value="reviews_desc">Avis décroissants</option><option value="rating_desc">Note Google</option><option value="task">Prochaine tâche</option><option value="appointment">Prochain RDV</option><option value="status">Statut</option><option value="city">Ville</option></select><button onClick={() => setShowCreate(true)} className="ao-btn-primary px-4 text-xs font-black">+ Nouveau lead</button></div>
    {showFilters ? <div className="grid gap-2 rounded-xl border border-[#E8E4DB] bg-white p-3 sm:grid-cols-3 lg:grid-cols-6">
      <FilterSelect label="Ville" value={filters.city} onChange={(value) => setFilters({ ...filters, city: value })} options={cities} /><FilterSelect label="Métier" value={filters.businessType} onChange={(value) => setFilters({ ...filters, businessType: value })} options={types} /><FilterSelect label="Statut" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={[...COMMERCIAL_STATUSES]} />
      <label className="ao-label">Note min<input type="number" min="0" max="5" step="0.1" value={filters.minRating} onChange={(e) => setFilters({ ...filters, minRating: e.target.value })} className="ao-input h-9 px-2" /></label><label className="ao-label">Avis min<input type="number" min="0" value={filters.minReviews} onChange={(e) => setFilters({ ...filters, minReviews: e.target.value })} className="ao-input h-9 px-2" /></label><label className="ao-label">Date d’ajout<input type="date" value={filters.addedAfter} onChange={(e) => setFilters({ ...filters, addedAfter: e.target.value })} className="ao-input h-9 px-2" /></label>
      {([['phone','Téléphone'],['email','Email'],['website','Site'],['account','Compte créé'],['enabled','Compte activé'],['appointment','RDV prévu'],['task','Prochaine tâche']] as const).map(([key,label]) => <PresenceFilter key={key} label={label} value={filters[key]} onChange={(value) => setFilters({ ...filters, [key]: value })} />)}
      <button onClick={() => setFilters({ city: "", businessType: "", status: "", minRating: "", minReviews: "", phone: "all", email: "all", website: "all", account: "all", enabled: "all", appointment: "all", task: "all", addedAfter: "" })} className="self-end rounded-lg px-2 py-2 text-xs font-black text-[#4C1D95]">Réinitialiser</button>
    </div> : null}
    <div className="overflow-hidden rounded-xl border border-[#E8E4DB] bg-white shadow-sm"><div className="border-b border-[#E8E4DB] px-4 py-3 text-xs font-bold text-[#6B617F]">{visible.length} résultat{visible.length > 1 ? "s" : ""}</div><div className="overflow-x-auto"><table className="min-w-[1320px] w-full text-left text-xs"><thead className="bg-[#FAF9F7] text-[10px] uppercase tracking-wide text-[#8B7AA8]"><tr>{["Nom", "Ville", "Métier", "Téléphone", "Email", "Avis", "Note", "Statut", "Compte AtriumOne", "Prochaine tâche", "Prochain RDV", "Dernière interaction", ""].map((label) => <th key={label} className="p-3 font-black">{label}</th>)}</tr></thead><tbody>{visible.map((lead) => <tr key={lead.id} className="border-t border-[#EEEAE3] hover:bg-[#FCFBF9]"><td className="p-3"><Link href={`/crm/leads/${lead.id}`} className="font-black hover:text-[#4C1D95]">{lead.name}</Link><div className="mt-0.5 text-[10px] text-[#8B7AA8]">{lead.lead_source}</div></td><td className="p-3 font-semibold">{lead.city ?? "—"}</td><td className="p-3">{lead.business_type ?? "—"}</td><td className="p-3">{lead.phone ?? "—"}</td><td className="max-w-[170px] truncate p-3">{lead.email ?? "—"}</td><td className="p-3">{lead.google_reviews_count ?? "—"}</td><td className="p-3 font-black">{lead.google_rating ? `${lead.google_rating} ★` : "—"}</td><td className="p-2"><select aria-label={`Statut de ${lead.name}`} value={lead.commercial_status} disabled={busyId === lead.id} onChange={(event) => void updateLead(lead.id, { commercial_status: event.target.value })} className="ao-select h-8 min-w-[135px] px-2 text-[11px] font-black">{COMMERCIAL_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${lead.account_access?.account_enabled ? "bg-emerald-50 text-emerald-700" : lead.business_id ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{lead.account_access?.account_enabled ? "Actif" : lead.business_id ? "En attente" : "Aucun compte"}</span></td><td className="p-3">{lead.next_task ? <>{dateLabel(lead.next_task.due_date)}<div className="text-[10px] text-[#8B7AA8]">{lead.next_task.title}</div></> : "—"}</td><td className="p-3">{lead.next_appointment ? <>{dateLabel(lead.next_appointment.appointment_date)} · {lead.next_appointment.appointment_time.slice(0,5)}<div className="text-[10px] text-[#8B7AA8]">{lead.next_appointment.type}</div></> : "—"}</td><td className="p-3">{dateLabel(lead.last_interaction)}</td><td className="p-3"><button onClick={() => { if (confirm(`Archiver ${lead.name} ?`)) void updateLead(lead.id, { archived_at: new Date().toISOString() }).then(() => setLeads((current) => current.filter((item) => item.id !== lead.id))); }} className="text-[11px] font-black text-[#8B7AA8]">Archiver</button></td></tr>)}</tbody></table>{!visible.length ? <div className="p-10 text-center text-sm font-semibold text-[#8B7AA8]">Aucun prospect ne correspond à ces filtres.</div> : null}</div></div>
    {showCreate ? <div className="ao-modal-backdrop"><form onSubmit={createLead} className="ao-modal-content max-w-xl p-5"><div className="flex justify-between"><h2 className="text-lg font-black">Nouveau lead manuel</h2><button type="button" onClick={() => setShowCreate(false)}>✕</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["name","Nom *"],["business_type","Métier"],["city","Ville"],["phone","Téléphone"],["email","Email"],["website","Site"]].map(([name,label]) => <label key={name} className="ao-label">{label}<input name={name} required={name === "name"} className="ao-input h-10 px-3" /></label>)}<label className="ao-label sm:col-span-2">Adresse<input name="address" className="ao-input h-10 px-3" /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="ao-btn-secondary px-4 py-2 text-xs font-black">Annuler</button><button className="ao-btn-primary px-4 py-2 text-xs font-black">Créer la fiche</button></div></form></div> : null}
  </div>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="ao-label">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="ao-select h-9 px-2"><option value="">Tous</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function PresenceFilter({ label, value, onChange }: { label: string; value: Presence; onChange: (value: Presence) => void }) { return <label className="ao-label">{label}<select value={value} onChange={(e) => onChange(e.target.value as Presence)} className="ao-select h-9 px-2"><option value="all">Tous</option><option value="yes">Oui</option><option value="no">Non</option></select></label>; }
