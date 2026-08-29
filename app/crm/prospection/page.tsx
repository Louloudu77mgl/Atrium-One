import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { ProspectionWorkspace } from "@/components/crm/ProspectionWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ProspectionPage() {
  const supabase = await createServerSupabaseClient() as any;
  const { data } = await supabase.from("crm_searches").select("*").order("created_at", { ascending: false }).limit(30);
  return <><CrmPageHeader eyebrow="Acquisition" title="Prospection" description="Recherchez des commerces locaux, contrôlez les doublons et ajoutez vos sélections au pipeline." /><ProspectionWorkspace initialSearches={data ?? []} /></>;
}
