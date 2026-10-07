import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReleasesClient } from "./ReleasesClient";
import { requireCrmAdmin } from "@/lib/crm/access";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  await requireCrmAdmin();
  const supabase = await createServerSupabaseClient();
  const [{ data: releases }, { data: sends }] = await Promise.all([
    supabase.from("crm_releases").select("*").order("release_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("crm_release_sends").select("*").order("created_at", { ascending: false }).limit(50)
  ]);
  return <div>
    <header className="border-b border-[#E8E4DB] bg-white px-5 py-5 lg:px-8"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B7AA8]">Communication AtriumOne · Administration</div><div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black tracking-[-.03em]">Releases & e-mails</h1><p className="mt-1 text-sm font-semibold text-[#6B617F]">Rédigez vos newsletters avec Hans et envoyez-les aux utilisateurs actifs après relecture.</p></div></div></header>
    <main className="p-5 lg:p-8"><ReleasesClient initialReleases={releases ?? []} initialSends={sends ?? []} /></main>
  </div>;
}
