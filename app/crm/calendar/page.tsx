import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { CalendarWorkspace } from "@/components/crm/CalendarWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient() as any;
  const [{ data: tasks }, { data: appointments }] = await Promise.all([
    supabase.from("crm_tasks").select("*,crm_leads(id,name,city)").order("due_date").order("due_time"),
    supabase.from("crm_appointments").select("*,crm_leads(id,name,city)").order("appointment_date").order("appointment_time")
  ]);
  return <><CrmPageHeader eyebrow="Organisation" title="Calendrier" description="Tâches, appels, démonstrations et onboardings réunis dans une seule vue." /><CalendarWorkspace initialTasks={tasks ?? []} initialAppointments={appointments ?? []} /></>;
}
