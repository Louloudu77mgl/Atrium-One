import Link from "next/link";
import { sortCalendarTasks } from "@/lib/crm/logic";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LeadRow = { id: string; name: string; city: string | null; commercial_status: string; created_at: string };
type RelatedLead = { id: string; name: string; deleted_at: string | null; archived_at: string | null };
type TaskRow = { id: string; lead_id: string; title: string; due_date: string; due_time: string | null; crm_leads: RelatedLead | RelatedLead[] | null };
type EventRow = { id: string; lead_id: string; title: string; type: string; event_date: string; event_time: string | null; crm_leads: RelatedLead | RelatedLead[] | null };
type OpportunityRow = { id: string; status: string; mrr: number | string; arr: number | string; closed_at: string | null; crm_leads: RelatedLead | RelatedLead[] | null };

function dateKeyInParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

const money = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

export default async function CrmHomePage() {
  const supabase = await createServerSupabaseClient() as any;
  const today = dateKeyInParis();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [leadsResult, tasksResult, eventsResult, opportunitiesResult] = await Promise.all([
    supabase.from("crm_leads").select("id,name,city,commercial_status,created_at").is("deleted_at", null).is("archived_at", null),
    supabase.from("crm_tasks").select("id,lead_id,title,due_date,due_time,crm_leads!inner(id,name,deleted_at,archived_at)").eq("completed", false).eq("due_date", today).is("crm_leads.deleted_at", null).is("crm_leads.archived_at", null),
    supabase.from("crm_events").select("id,lead_id,title,type,event_date,event_time,crm_leads!inner(id,name,deleted_at,archived_at)").is("crm_leads.deleted_at", null).is("crm_leads.archived_at", null),
    supabase.from("crm_opportunities").select("id,status,mrr,arr,closed_at,crm_leads!inner(id,name,deleted_at,archived_at)").is("crm_leads.deleted_at", null).is("crm_leads.archived_at", null)
  ]);

  const leads = (leadsResult.data ?? []) as LeadRow[];
  const todayTasks = sortCalendarTasks((tasksResult.data ?? []) as TaskRow[]);
  const events = (eventsResult.data ?? []) as EventRow[];
  const opportunities = (opportunitiesResult.data ?? []) as OpportunityRow[];
  const openOpportunities = opportunities.filter((item) => !["Gagnée", "Perdue"].includes(item.status));
  const won = opportunities.filter((item) => item.status === "Gagnée");
  const lost = opportunities.filter((item) => item.status === "Perdue");
  const closed = won.length + lost.length;
  const pipelineMrr = openOpportunities.reduce((sum, item) => sum + Number(item.mrr || 0), 0);
  const pipelineArr = openOpportunities.reduce((sum, item) => sum + Number(item.arr || 0), 0);
  const signedMrr = won.reduce((sum, item) => sum + Number(item.mrr || 0), 0);
  const signedArr = won.reduce((sum, item) => sum + Number(item.arr || 0), 0);
  const upcomingEvents = events.filter((item) => item.type !== "Appel effectué" && item.event_date >= today).sort((a, b) => `${a.event_date}${a.event_time ?? "99:99"}`.localeCompare(`${b.event_date}${b.event_time ?? "99:99"}`));
  const eventCount = (type: string) => events.filter((item) => item.type === type).length;
  const hasError = [leadsResult, tasksResult, eventsResult, opportunitiesResult].some((result) => result.error);

  return <div>
    <header className="border-b border-[#E8E4DB] bg-white px-5 py-5 lg:px-8">
      <div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B7AA8]">Cockpit commercial</div>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black tracking-[-.03em]">Vue d’ensemble</h1><p className="mt-1 text-sm font-semibold text-[#6B617F]">Prospection, activité, pipeline et revenus AtriumOne.</p></div><Link href="/crm/calendar" className="ao-btn-primary px-4 py-2.5 text-xs font-black">Ouvrir ma journée</Link></div>
      {hasError ? <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Certains indicateurs n’ont pas pu être chargés. Les données disponibles restent affichées.</div> : null}
    </header>

    <main className="space-y-5 p-5 lg:p-8">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Prospects actifs" value={leads.length.toLocaleString("fr-FR")} detail={`${leads.filter((lead) => ["Client", "Signé"].includes(lead.commercial_status)).length} clients`} href="/crm/leads" />
        <KpiCard label="Nouveaux · 30 jours" value={leads.filter((lead) => lead.created_at >= thirtyDaysAgo).length.toLocaleString("fr-FR")} detail="Prospects ajoutés" tone="green" />
        <KpiCard label="Opportunités ouvertes" value={openOpportunities.length.toLocaleString("fr-FR")} detail={`${won.length} gagnées · ${lost.length} perdues`} />
        <KpiCard label="Taux de closing" value={`${closed ? Math.round((won.length / closed) * 100) : 0} %`} detail={`${closed} affaires closes`} tone="violet" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pipeline MRR" value={money(pipelineMrr)} detail={money(pipelineArr) + " ARR"} tone="violet" />
        <KpiCard label="Pipeline ARR" value={money(pipelineArr)} detail={`${openOpportunities.length} opportunités actives`} />
        <KpiCard label="MRR signé" value={money(signedMrr)} detail={`${won.length} affaires gagnées`} tone="green" />
        <KpiCard label="ARR signé" value={money(signedArr)} detail="Revenus annuels gagnés" tone="green" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <section className="rounded-xl border border-[#E8E4DB] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#EEEAE2] px-4 py-3"><div><h2 className="text-sm font-black">Activité commerciale</h2><p className="mt-0.5 text-[11px] font-semibold text-[#8B7AA8]">Événements consignés depuis le démarrage</p></div><Link href="/crm/leads" className="text-xs font-black text-[#4C1D95]">Voir les prospects →</Link></div>
          <div className="grid grid-cols-2 gap-px bg-[#EEEAE2] sm:grid-cols-4">
            <ActivityMetric label="Appels" value={eventCount("Appel effectué")} />
            <ActivityMetric label="R1" value={eventCount("R1")} accent />
            <ActivityMetric label="R2" value={eventCount("R2")} accent />
            <ActivityMetric label="R3" value={eventCount("R3")} accent />
          </div>
          <div className="grid gap-0 border-t border-[#EEEAE2] sm:grid-cols-2">
            <DashboardList title={`Aujourd’hui · ${todayTasks.length} tâche${todayTasks.length > 1 ? "s" : ""}`} empty="Aucune tâche prévue aujourd’hui." href={`/crm/calendar?view=day&day=${today}`} items={todayTasks.slice(0, 8).map((task) => ({ id: task.id, leadId: task.lead_id, title: task.title, meta: task.due_time ? task.due_time.slice(0, 5) : "Sans horaire" }))} />
            <DashboardList title={`Prochains RDV · ${upcomingEvents.length}`} empty="Aucun rendez-vous planifié." href="/crm/calendar" bordered items={upcomingEvents.slice(0, 8).map((event) => ({ id: event.id, leadId: event.lead_id, title: event.title, meta: `${new Date(`${event.event_date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}${event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}` }))} />
          </div>
        </section>

        <section className="rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-black">Pipeline</h2><p className="mt-0.5 text-[11px] font-semibold text-[#8B7AA8]">Répartition des opportunités</p></div><span className="rounded-full bg-[#F3E8FF] px-2.5 py-1 text-[10px] font-black text-[#6D28D9]">{opportunities.length} total</span></div>
          <div className="mt-4 space-y-3">{["Ouverte", "Qualification", "Proposition", "Négociation", "Gagnée", "Perdue"].map((status) => { const count = opportunities.filter((item) => item.status === status).length; const width = opportunities.length ? Math.max(4, Math.round((count / opportunities.length) * 100)) : 0; return <div key={status}><div className="mb-1 flex justify-between text-[11px] font-black"><span>{status}</span><span>{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#F1EEE8]"><div className={`h-full rounded-full ${status === "Gagnée" ? "bg-emerald-500" : status === "Perdue" ? "bg-red-400" : "bg-gradient-to-r from-violet-600 to-fuchsia-500"}`} style={{ width: `${width}%` }} /></div></div>; })}</div>
        </section>
      </div>
    </main>
  </div>;
}

function KpiCard({ label, value, detail, tone = "default", href }: { label: string; value: string; detail: string; tone?: "default" | "green" | "violet"; href?: string }) { const content = <><div className="text-[10px] font-black uppercase tracking-[.1em] text-[#8B7AA8]">{label}</div><div className={`mt-2 text-2xl font-black tracking-[-.04em] ${tone === "green" ? "text-emerald-600" : tone === "violet" ? "text-[#7C3AED]" : "text-[#211432]"}`}>{value}</div><div className="mt-1 text-[11px] font-semibold text-[#6B617F]">{detail}</div></>; return href ? <Link href={href} className="rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C4B5FD] hover:shadow-md">{content}</Link> : <article className="rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm">{content}</article>; }
function ActivityMetric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) { return <div className="bg-white px-4 py-5"><div className={`text-2xl font-black ${accent ? "text-fuchsia-600" : "text-[#211432]"}`}>{value.toLocaleString("fr-FR")}</div><div className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#8B7AA8]">{label}</div></div>; }
function DashboardList({ title, items, empty, href, bordered = false }: { title: string; items: Array<{ id: string; leadId: string; title: string; meta: string }>; empty: string; href: string; bordered?: boolean }) { return <div className={`p-4 ${bordered ? "border-t border-[#EEEAE2] sm:border-l sm:border-t-0" : ""}`}><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-black">{title}</h3><Link href={href} className="text-[10px] font-black text-[#6D28D9]">Tout voir</Link></div><div className="space-y-1.5">{items.map((item) => <Link key={item.id} href={`/crm/leads/${item.leadId}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[#F8F5FF]"><span className="w-16 shrink-0 text-[10px] font-black text-[#8B7AA8]">{item.meta}</span><span className="truncate text-xs font-bold">{item.title}</span></Link>)}{!items.length ? <div className="rounded-lg border border-dashed border-[#DDD6CC] p-4 text-center text-xs font-semibold text-[#8B7AA8]">{empty}</div> : null}</div></div>; }
