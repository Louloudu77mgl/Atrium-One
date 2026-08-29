import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { CalendarWorkspace } from "@/components/crm/CalendarWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient() as any;
  const [{ data: tasks }, { data: events }] = await Promise.all([
    supabase.from("crm_tasks").select("*,crm_leads(id,name,city)").order("due_date").order("due_time"),
    supabase.from("crm_events").select("*,crm_leads(id,name,city)").order("event_date").order("event_time")
  ]);
  return <><CrmPageHeader eyebrow="Organisation" title="Calendrier" description="Tâches et événements commerciaux réunis dans une seule vue." /><CalendarWorkspace initialTasks={tasks ?? []} initialEvents={events ?? []} /></>;
}
