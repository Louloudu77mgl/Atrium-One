"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CrmGmailCard({ connected, address, status, error }: { connected: boolean; address: string | null; status: string; error: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    if (!window.confirm("Déconnecter le compte Gmail utilisé par AtriumOne ?")) return;
    setBusy(true);
    const response = await fetch("/api/crm/gmail/disconnect", { method: "POST" });
    if (response.ok) router.refresh(); else setBusy(false);
  }
  return <section className="max-w-[780px] rounded-2xl border border-[#E8E4DB] bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[.12em] text-[#8B7AA8]">Communication AtriumOne</div><h2 className="mt-2 text-xl font-black">Gmail administrateur</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#6B617F]">Ce compte sert uniquement à envoyer les annonces de Releases AtriumOne. Il est séparé des connexions Gmail des commerçants.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${connected ? "bg-emerald-50 text-emerald-700" : status === "error" ? "bg-red-50 text-red-700" : "bg-[#F1EEE8] text-[#6B617F]"}`}>{connected ? "Connecté" : status === "error" ? "À reconnecter" : "Non connecté"}</span></div>
    {address ? <p className="mt-5 rounded-xl bg-[#F8F5FF] px-4 py-3 text-sm font-bold text-[#4C1D95]">{address}</p> : null}
    {error ? <p className="mt-3 text-xs font-bold text-red-700">{error}</p> : null}
    <div className="mt-5 flex flex-wrap gap-3"><a href="/api/crm/gmail/connect" className="rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-black text-white">{connected ? "Reconnecter Gmail" : "Connecter Gmail"}</a>{connected ? <button type="button" onClick={() => void disconnect()} disabled={busy} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-black text-red-700 disabled:opacity-50">Déconnecter</button> : null}</div>
  </section>;
}
