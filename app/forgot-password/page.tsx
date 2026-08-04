import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { mapLoginPageErrorMessage } from "@/lib/auth/google-login";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = mapLoginPageErrorMessage(params?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#F3E8FF_0,#FBFAFF_42%,#FFFFFF_100%)] px-4 py-10">
      <section className="w-full max-w-md rounded-[20px] border border-[#E9D5FF] bg-white p-8 shadow-[0_8px_32px_rgba(76,29,149,0.10)]">
        <Link href="/login" className="mb-8 flex items-center gap-2.5">
          <img src="/atriumone-logo.webp" alt="AtriumOne" className="h-[42px] w-[42px] object-contain drop-shadow-sm" />
          <span className="text-xl font-bold text-[#4C1D95]">
            Atrium<span className="text-[#A855F7]">One</span>
          </span>
        </Link>

        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Réinitialisation</p>
          <h1 className="text-2xl font-bold text-[#211432]">Mot de passe oublié ?</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B617F]">Entrez votre email et nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#DC2626]">
            {errorMessage}
          </div>
        ) : null}

        {params?.message ? (
          <div className="mb-4 rounded-lg border border-[#DDD6FE] bg-[#F3E8FF] px-3.5 py-2.5 text-sm text-[#7C3AED]">
            {params.message}
          </div>
        ) : null}

        {!hasSupabaseEnv() ? (
          <div className="mb-4 rounded-lg border border-[#DDD6FE] bg-[#F5F0FF] px-3.5 py-2.5 text-sm text-[#6B617F]">
            Ajoutez les variables Supabase dans `.env.local` pour activer la réinitialisation.
          </div>
        ) : null}

        <ForgotPasswordForm />

        <p className="mt-6 text-center text-xs text-[#6B617F]">
          <Link href="/login" className="font-semibold text-[#4C1D95] underline">
            Retour à la connexion
          </Link>
        </p>
      </section>
    </main>
  );
}
