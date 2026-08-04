"use client";

import { useMemo, useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedEmail = useMemo(() => email.trim(), [email]);

  async function sendResetLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedEmail) {
      setError("Ajoutez votre email pour recevoir le lien de réinitialisation.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: trimmedEmail,
          redirectTo
        })
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string; message?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Impossible d’envoyer le lien de réinitialisation pour le moment.");
        setLoading(false);
        return;
      }

      setMessage(payload.message ?? "Si un compte existe, un email de réinitialisation vient d’être envoyé. Vous pouvez aussi renvoyer le lien.");
      setLoading(false);
    } catch (requestError) {
      console.error("[auth/reset-password]", "request_failed", requestError);
      setError("Impossible d’envoyer le lien de réinitialisation pour le moment.");
      setLoading(false);
    }
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#DC2626]">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mb-4 rounded-lg border border-[#DDD6FE] bg-[#F3E8FF] px-3.5 py-2.5 text-sm text-[#7C3AED]">
          {message}
        </div>
      ) : null}

      <form onSubmit={sendResetLink} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Email professionnel</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="contact@maisonlavigne.fr"
            className="w-full rounded-lg border border-[#E9D5FF] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#8B7AA8] focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-60"
        >
          {loading ? "Envoi..." : message ? "Renvoyer l’email" : "Envoyer le lien"}
        </button>
      </form>
    </>
  );
}
