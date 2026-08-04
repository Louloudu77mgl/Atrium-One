"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    void supabase.auth.getUser().then(({ data }) => {
      setReady(Boolean(data.user));
    });
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Impossible de mettre à jour le mot de passe. Réessayez depuis le lien reçu par email.");
      setLoading(false);
      return;
    }

    setMessage("Votre mot de passe a bien été mis à jour. Vous pouvez vous connecter.");
    setLoading(false);
    setPassword("");
    setConfirmPassword("");
  }

  if (!ready && !message) {
    return (
      <div className="rounded-lg border border-[#DDD6FE] bg-[#F5F0FF] px-3.5 py-2.5 text-sm text-[#6B617F]">
        Le lien de réinitialisation est peut-être expiré. Redemandez un nouveau lien.
      </div>
    );
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

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Nouveau mot de passe</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={8} placeholder="8 caractères minimum" className="w-full rounded-lg border border-[#E9D5FF] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#8B7AA8] focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Confirmer le mot de passe</span>
          <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" required minLength={8} placeholder="Confirmez votre mot de passe" className="w-full rounded-lg border border-[#E9D5FF] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#8B7AA8] focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
        </label>
        <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-60">
          {loading ? "Mise à jour..." : "Enregistrer le nouveau mot de passe"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-[#6B617F]">
        <Link href="/login" className="font-semibold text-[#4C1D95] underline">
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
