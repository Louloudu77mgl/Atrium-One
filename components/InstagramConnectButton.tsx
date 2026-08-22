"use client";

import { useState } from "react";

export function InstagramConnectButton({
  label,
  className
}: {
  label: string;
  className: string;
}) {
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function connect() {
    if (connecting) return;

    const instagramTab = window.open("about:blank", "_blank");
    if (!instagramTab) {
      setMessage("Autorisez les fenêtres pop-up pour AtriumOne puis réessayez.");
      return;
    }

    setConnecting(true);
    setMessage("Instagram s’ouvre dans un nouvel onglet…");
    instagramTab.location.href = "/api/instagram/connect";

    const startedAt = Date.now();
    const connectionWatcher = window.setInterval(async () => {
      try {
        const response = await fetch("/api/instagram/status", {
          method: "GET",
          cache: "no-store"
        });
        const data = (await response.json()) as { status?: string };

        if (response.ok && data.status === "connected") {
          window.clearInterval(connectionWatcher);
          if (!instagramTab.closed) instagramTab.close();
          window.location.replace("/social?saved=instagram");
          return;
        }
      } catch {}

      if (instagramTab.closed) {
        window.clearInterval(connectionWatcher);
        window.location.reload();
        return;
      }

      if (Date.now() - startedAt > 2 * 60 * 1000) {
        window.clearInterval(connectionWatcher);
        setConnecting(false);
        setMessage("La connexion prend plus de temps que prévu. Vous pouvez réessayer.");
      }
    }, 1_200);
  }

  return (
    <div>
      <button type="button" onClick={connect} disabled={connecting} className={className}>
        {connecting ? "Connexion en cours…" : label}
      </button>
      {message ? <p className="mt-2 max-w-sm text-xs text-[#6B617F]">{message}</p> : null}
    </div>
  );
}
