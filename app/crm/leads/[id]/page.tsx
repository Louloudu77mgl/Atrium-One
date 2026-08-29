import { notFound } from "next/navigation";
import { LeadDetailWorkspace } from "@/components/crm/LeadDetailWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { associationStrength } from "@/lib/crm/logic";

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = /^\/crm\/calendar\?view=(today|day|week|month)&day=\d{4}-\d{2}-\d{2}$/.test(query.returnTo ?? "") ? query.returnTo : undefined;
  const supabase = await createServerSupabaseClient() as any;
  const [{ data: lead }, { data: notes }, { data: tasks }, { data: events }, { data: opportunities }, { data: activity }] = await Promise.all([
    supabase.from("crm_leads").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("crm_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("crm_tasks").select("*").eq("lead_id", id).order("completed").order("due_date").order("due_time"),
    supabase.from("crm_events").select("*").eq("lead_id", id).order("event_date", { ascending: false }).order("event_time", { ascending: false }),
    supabase.from("crm_opportunities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("crm_activity").select("*").eq("lead_id", id).in("type", ["call_completed", "task_completed", "r1_completed", "r2_completed", "r3_completed", "followup_completed", "appointment_created"]).order("created_at", { ascending: false }).limit(100)
  ]);
  if (!lead) notFound();
  let access = null; let modules: Array<{ module_key: string; enabled: boolean }> = []; let account: { email: string | null; createdAt: string | null; lastSignInAt: string | null } | null = null; let candidates: Array<{ businessId: string; userId: string; businessName: string; email: string | null; reason: string }> = [];
  if (lead.business_id) {
    [{ data: access }, { data: modules }] = await Promise.all([
      supabase.from("business_access").select("*").eq("business_id", lead.business_id).maybeSingle(),
      supabase.from("business_module_access").select("module_key,enabled").eq("business_id", lead.business_id)
    ]);
  }
  if (hasSupabaseAdminEnv()) {
    const admin = createSupabaseAdminClient() as any;
    if (lead.auth_user_id) {
      const { data } = await admin.auth.admin.getUserById(lead.auth_user_id);
      account = data.user ? { email: data.user.email ?? null, createdAt: data.user.created_at, lastSignInAt: data.user.last_sign_in_at ?? null } : null;
    } else {
      const [{ data: merchants }, usersResult] = await Promise.all([admin.from("merchants").select("id,user_id,business_name,phone,website_url"), admin.auth.admin.listUsers({ page: 1, perPage: 1000 })]);
      const userMap = new Map<string, string | null>((usersResult.data.users ?? []).map((user: any) => [String(user.id), typeof user.email === "string" ? user.email.toLowerCase() : null] as [string, string | null]));
      candidates = (merchants ?? []).flatMap((merchant: any) => { const email = userMap.get(merchant.user_id) ?? null; const strength = associationStrength({ leadEmail: lead.email, accountEmail: email, leadPhone: lead.phone, accountPhone: merchant.phone, leadWebsite: lead.website, accountWebsite: merchant.website_url }); const reason = strength === "exact_email" ? "Email exact" : strength === "phone" ? "Téléphone correspondant" : strength === "domain" ? "Domaine correspondant" : ""; return reason ? [{ businessId: merchant.id, userId: merchant.user_id, businessName: merchant.business_name, email, reason }] : []; });
    }
  }
  return <LeadDetailWorkspace returnTo={returnTo} initial={{ lead, notes: notes ?? [], tasks: tasks ?? [], events: events ?? [], opportunities: opportunities ?? [], activity: activity ?? [], access, modules, account, candidates }} />;
}
