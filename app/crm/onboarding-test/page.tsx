import { TestOnboardingWorkspace } from "@/components/crm/TestOnboardingWorkspace";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LeadOption = {
  id: string;
  name: string;
  email: string | null;
  business_id: string | null;
  commercial_status: string;
};

export default async function TestOnboardingPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: requestedLeadId } = await searchParams;
  const supabase = await createServerSupabaseClient() as any;
  const { data } = await supabase.from("crm_leads").select("id,name,email,business_id,commercial_status").is("deleted_at", null).is("archived_at", null).order("name").limit(1000);
  const leads = (data ?? []) as LeadOption[];
  const selectedLead = leads.find((lead) => lead.id === requestedLeadId) ?? null;
  const connectionState = selectedLead?.business_id && hasSupabaseAdminEnv()
    ? await loadConnectionState(selectedLead.business_id)
    : null;

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  const instagramConfigured = Boolean((process.env.INSTAGRAM_APP_ID ?? process.env.META_CLIENT_ID) && (process.env.INSTAGRAM_APP_SECRET ?? process.env.META_CLIENT_SECRET));
  const gmailConfigured = Boolean((process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID) && (process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET));

  return <TestOnboardingWorkspace
    leads={leads}
    initialLeadId={selectedLead?.id ?? null}
    connectionState={connectionState}
    providerState={{ googleConfigured, instagramConfigured, gmailConfigured }}
  />;
}

async function loadConnectionState(businessId: string) {
  const admin = createSupabaseAdminClient() as any;
  const [access, modules, google, instagram, gmail] = await Promise.all([
    admin.from("business_access").select("account_enabled,onboarding_status").eq("business_id", businessId).maybeSingle(),
    admin.from("business_module_access").select("module_key,enabled").eq("business_id", businessId),
    admin.from("google_connections").select("status,google_account_email,google_location_id,google_location_name,last_sync_at,last_error").eq("merchant_id", businessId).maybeSingle(),
    admin.from("instagram_connections").select("status,instagram_username,last_checked_at,last_error").eq("merchant_id", businessId).maybeSingle(),
    admin.from("gmail_connections").select("status,gmail_address,last_checked_at,last_error").eq("merchant_id", businessId).maybeSingle()
  ]);

  return {
    account: access.data ?? null,
    modules: modules.data ?? [],
    google: google.data ?? null,
    instagram: instagram.data ?? null,
    gmail: gmail.data ?? null
  };
}
