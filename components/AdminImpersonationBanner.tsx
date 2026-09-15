"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

export function AdminImpersonationBanner({ businessName, leadId }: { businessName: string; leadId: string }) {
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);

  if (pathname.startsWith("/crm") || pathname.startsWith("/login")) return null;

  async function leaveClientSpace() {
    if (leaving) return;
    setLeaving(true);
    try {
      await fetch("/api/crm/impersonation", { method: "DELETE" });
    } finally {
      window.location.assign(`/crm/leads/${leadId}?tab=access`);
    }
  }

  return (
    <aside className="fixed bottom-20 left-3 right-3 z-[90] rounded-xl border border-violet-300 bg-[#2E1065] p-3 text-white shadow-2xl md:bottom-4 md:left-auto md:right-4 md:w-[390px]" aria-label="Mode administrateur AtriumOne">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-base" aria-hidden>👁</span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[.12em] text-violet-200">Mode administrateur</div>
          <div className="truncate text-sm font-black">Vous gérez {businessName}</div>
        </div>
        <button type="button" disabled={leaving} onClick={() => void leaveClientSpace()} className="shrink-0 rounded-lg bg-white px-3 py-2 text-[11px] font-black text-[#4C1D95] transition hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60">{leaving ? "Retour…" : "Retour au CRM"}</button>
      </div>
    </aside>
  );
}
