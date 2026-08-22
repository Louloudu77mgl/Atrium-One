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

    setConnecting(true);
    setMessage("Redirection sécurisée vers Instagram…");
    window.location.assign("/api/instagram/connect");
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
