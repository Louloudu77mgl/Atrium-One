import { PreOnboardingsWorkspace } from "@/components/crm/PreOnboardingsWorkspace";
import { PRE_ONBOARDING_PUBLIC_PATH } from "@/lib/crm/pre-onboarding";
import { createSessionSupabaseClient as createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CrmPreOnboardingsPage() {
  const supabase = await createServerSupabaseClient() as any;
  const { data, error } = await supabase.from("crm_pre_onboardings")
    .select("*,crm_leads(id,name,city,commercial_status)")
    .order("submitted_at", { ascending: false });
  return <PreOnboardingsWorkspace initial={data ?? []} publicPath={PRE_ONBOARDING_PUBLIC_PATH} loadError={error ? "Les pré-onboardings n’ont pas pu être chargés. Vérifiez que la migration est appliquée." : null} />;
}
