"use client";

import { useState } from "react";
import { buttonStyles } from "@/lib/design-system";

export function IntegrationDisconnectButton({ endpoint, label }: { endpoint: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function disconnect() {
    if (!window.confirm(`Déconnecter ${label} ? Les automatisations liées à ce compte seront arrêtées.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Déconnexion impossible.");
      window.location.reload();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Déconnexion impossible.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void disconnect()} disabled={busy} className={`${buttonStyles.tertiary} text-red-700 disabled:opacity-50`}>
        {busy ? "Déconnexion…" : "Déconnecter"}
      </button>
      {error ? <p className="mt-2 text-xs font-bold text-red-700">{error}</p> : null}
    </div>
  );
}
