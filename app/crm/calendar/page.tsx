import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { CalendarWorkspace } from "@/components/crm/CalendarWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CalendarView = "today" | "day" | "week" | "month";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ day?: string; view?: string }> }) {
  const query = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const requestedDay = query.day ?? "";
  const initialDay = /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) && !Number.isNaN(new Date(`${requestedDay}T12:00:00`).getTime()) ? requestedDay : today;
  const initialView: CalendarView = ["today", "day", "week", "month"].includes(query.view ?? "") ? query.view as CalendarView : "today";
  const supabase = await createServerSupabaseClient() as any;
  const [{ data: tasks }, { data: events }, { data: plannerLeads }] = await Promise.all([
    supabase.from("crm_tasks").select("*,crm_leads!inner(id,name,city,phone,email,business_type,deleted_at,archived_at)").eq("completed", false).is("crm_leads.deleted_at", null).is("crm_leads.archived_at", null).order("due_date").order("due_time"),
    supabase.from("crm_events").select("*,crm_leads!inner(id,name,city,deleted_at,archived_at)").is("crm_leads.deleted_at", null).is("crm_leads.archived_at", null).order("event_date").order("event_time"),
    supabase.from("crm_leads").select("city,business_type,commercial_status,lead_source").is("deleted_at", null).is("archived_at", null)
  ]);
  const plannerOptions = {
    cities: [...new Set((plannerLeads ?? []).map((lead: { city: string | null }) => lead.city).filter(Boolean))].sort() as string[],
    businessTypes: [...new Set((plannerLeads ?? []).map((lead: { business_type: string | null }) => lead.business_type).filter(Boolean))].sort() as string[],
    sources: [...new Set((plannerLeads ?? []).map((lead: { lead_source: string | null }) => lead.lead_source).filter(Boolean))].sort() as string[]
  };
  return <><CrmPageHeader eyebrow="Organisation" title="Calendrier" description="Votre espace de travail quotidien pour les appels, relances et rendez-vous." /><CalendarWorkspace initialTasks={tasks ?? []} initialEvents={events ?? []} initialDay={initialDay} initialView={initialView} plannerOptions={plannerOptions} /></>;
}
