"use client";

import { useEffect, useState } from "react";
import type { RcuProgram } from "@/lib/rcu";
import type { RcuRaffleDrawRecord } from "@/lib/rcu-store";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

function currentParisMonth() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const value = (type: "year" | "month") => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}`;
}

type RaffleStatus = { month: string; ticketCount: number; draw: RcuRaffleDrawRecord | null };

export function RcuRaffleControl({ program }: { program: RcuProgram }) {
  const [month, setMonth] = useState(currentParisMonth);
  const [status, setStatus] = useState<RaffleStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchWithTimeout(`/api/rcu/forms/${program.slug}/raffle-draw?month=${month}`)
      .then(async (response) => {
        const data = (await response.json()) as RaffleStatus & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Chargement impossible.");
        if (active) setStatus(data);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Chargement impossible."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [month, program.slug]);

  async function draw() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(`/api/rcu/forms/${program.slug}/raffle-draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month })
      });
      const data = (await response.json()) as { draw?: RcuRaffleDrawRecord; error?: string };
      if (!response.ok || !data.draw) throw new Error(data.error ?? "Tirage impossible.");
      setStatus((current) => ({ month, ticketCount: current?.ticketCount ?? data.draw!.total_tickets, draw: data.draw! }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tirage impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs font-black uppercase tracking-wider text-amber-900">Mois du tirage<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="ao-input ao-focus mt-1 block px-3 py-2 text-sm" /></label>
        <div className="text-right"><div className="text-2xl font-black text-amber-950">{loading && !status ? "…" : status?.ticketCount ?? 0}</div><div className="text-xs font-bold text-amber-800">ticket(s) validé(s)</div></div>
      </div>
      {status?.draw ? <div className="mt-3 rounded-xl bg-white p-3 text-sm text-amber-950"><div className="font-black">🏆 {status.draw.winner_name}</div><div className="mt-1 font-mono text-xs">{status.draw.winner_ticket} · {status.draw.winner_phone}</div><div className="mt-1 text-xs font-semibold">Gain : {status.draw.prize_label}</div></div> : <button type="button" onClick={() => void draw()} disabled={loading || !status?.ticketCount} className="mt-3 rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Tirage en cours…" : "Tirer le gagnant"}</button>}
      {error ? <p className="mt-2 text-xs font-bold text-red-700">{error}</p> : null}
      <p className="mt-2 text-xs font-semibold text-amber-800">Un seul tirage sécurisé est possible par mois. Le gain remonte automatiquement dans le portefeuille du gagnant.</p>
    </div>
  );
}
