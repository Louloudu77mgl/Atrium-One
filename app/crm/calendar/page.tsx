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
  const [{ data: tasks }, { data: events }] = await Promise.all([
    supabase.from("crm_tasks").select("*,crm_leads(id,name,city,phone,email,business_type)").eq("completed", false).order("due_date").order("due_time"),
    supabase.from("crm_events").select("*,crm_leads(id,name,city)").order("event_date").order("event_time")
  ]);
  return <><CrmPageHeader eyebrow="Organisation" title="Calendrier" description="Votre espace de travail quotidien pour les appels, relances et rendez-vous." /><CalendarWorkspace initialTasks={tasks ?? []} initialEvents={events ?? []} initialDay={initialDay} initialView={initialView} /></>;
}
