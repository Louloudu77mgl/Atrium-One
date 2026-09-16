import { getCrmGmailConnection, isCrmGmailReady } from "@/lib/crm/gmail";
import { CrmGmailCard } from "./CrmGmailCard";

export const dynamic = "force-dynamic";

export default async function CrmSettingsPage({ searchParams }: { searchParams?: Promise<{ saved?: string; gmail_error?: string }> }) {
  const [params, connection] = await Promise.all([searchParams, getCrmGmailConnection()]);
  return <div>
    <header className="border-b border-[#E8E4DB] bg-white px-5 py-5 lg:px-8"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B7AA8]">CRM interne</div><h1 className="mt-1 text-2xl font-black tracking-[-.03em]">Réglages et intégrations</h1><p className="mt-1 text-sm font-semibold text-[#6B617F]">Connexions réservées aux communications AtriumOne.</p></header>
    <main className="p-5 lg:p-8">
      {params?.saved === "gmail" ? <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Gmail AtriumOne connecté.</div> : null}
      {params?.gmail_error ? <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{params.gmail_error}</div> : null}
      <CrmGmailCard connected={isCrmGmailReady(connection)} address={connection?.gmail_address ?? null} status={connection?.status ?? "disconnected"} error={connection?.last_error ?? null} />
    </main>
  </div>;
}
