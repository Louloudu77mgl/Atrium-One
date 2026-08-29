import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { LeadsWorkspace } from "@/components/crm/LeadsWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const supabase = await createServerSupabaseClient() as any;
  const [{ data: leads }, { data: tasks }, { data: appointments }, { data: access }, { data: activity }] = await Promise.all([
    supabase.from("crm_leads").select("*").is("deleted_at", null).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("crm_tasks").select("*").eq("completed", false).order("due_date").order("due_time"),
    supabase.from("crm_appointments").select("*").gte("appointment_date", new Date().toISOString().slice(0, 10)).order("appointment_date").order("appointment_time"),
    supabase.from("business_access").select("*"),
    supabase.from("crm_activity").select("lead_id,created_at").order("created_at", { ascending: false })
  ]);
  const taskByLead = new Map<string, any>(); for (const task of tasks ?? []) if (!taskByLead.has(task.lead_id)) taskByLead.set(task.lead_id, task);
  const appointmentByLead = new Map<string, any>(); for (const item of appointments ?? []) if (!appointmentByLead.has(item.lead_id)) appointmentByLead.set(item.lead_id, item);
  const accessByBusiness = new Map((access ?? []).map((item: any) => [item.business_id, item]));
  const lastByLead = new Map<string, string>(); for (const item of activity ?? []) if (!lastByLead.has(item.lead_id)) lastByLead.set(item.lead_id, item.created_at);
  const rows = (leads ?? []).map((lead: any) => ({ ...lead, next_task: taskByLead.get(lead.id) ?? null, next_appointment: appointmentByLead.get(lead.id) ?? null, account_access: lead.business_id ? accessByBusiness.get(lead.business_id) ?? null : null, last_interaction: lastByLead.get(lead.id) ?? null }));
  return <><CrmPageHeader eyebrow="Pipeline" title="Base de données" description={`${rows.length} prospects actifs dans le cockpit commercial.`} /><LeadsWorkspace initialLeads={rows} /></>;
}
