import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { ArchivesWorkspace } from "@/components/crm/ArchivesWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export default async function ArchivesPage() { const supabase = await createServerSupabaseClient() as any; const { data } = await supabase.from("crm_leads").select("*").not("archived_at", "is", null).is("deleted_at", null).order("archived_at", { ascending: false }); return <><CrmPageHeader eyebrow="Conservation" title="Archives" description="Les leads archivés restent restaurables et leurs comptes AtriumOne ne sont jamais supprimés." /><ArchivesWorkspace initialLeads={data ?? []} /></>; }
