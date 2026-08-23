"use client";

import { useState } from "react";
import { buttonStyles } from "@/lib/design-system";

export function GmailConnectionActions({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState<"test" | "disconnect" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function testConnection() {
    setBusy("test");
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/gmail/test", { method: "POST" });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Test Gmail impossible.");
      setNotice(payload.message || "E-mail test envoyé.");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Test Gmail impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/gmail/disconnect", { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Déconnexion impossible.");
      window.location.reload();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Déconnexion impossible.");
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <a href="/api/gmail/connect" className={buttonStyles.primary}>Connecter Gmail</a>
        ) : (
          <>
            <button type="button" onClick={() => void testConnection()} disabled={busy !== null} className={`${buttonStyles.secondary} disabled:opacity-50`}>
              {busy === "test" ? "Envoi du test…" : "Tester l’envoi"}
            </button>
            <a href="/api/gmail/connect" className={buttonStyles.tertiary}>Changer de compte</a>
            <button type="button" onClick={() => void disconnect()} disabled={busy !== null} className={`${buttonStyles.tertiary} text-red-700 disabled:opacity-50`}>
              {busy === "disconnect" ? "Déconnexion…" : "Déconnecter"}
            </button>
          </>
        )}
      </div>
      {notice ? <p className="mt-2 text-xs font-bold text-emerald-700">✓ {notice}</p> : null}
      {error ? <p className="mt-2 text-xs font-bold text-red-700">{error}</p> : null}
    </div>
  );
}
