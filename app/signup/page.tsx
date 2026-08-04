import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { mapLoginPageErrorMessage } from "@/lib/auth/google-login";
import { signup } from "@/lib/auth/actions";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = mapLoginPageErrorMessage(params?.error);

  if (hasSupabaseEnv()) {
    const user = await getCurrentUser();

    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#F3E8FF_0,#FBFAFF_42%,#FFFFFF_100%)] px-4 py-10">
      <section className="w-full max-w-md rounded-[20px] border border-[#E9D5FF] bg-white p-8 shadow-[0_8px_32px_rgba(76,29,149,0.10)]">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5">
          <img src="/atriumone-logo.webp" alt="AtriumOne" className="h-[42px] w-[42px] object-contain drop-shadow-sm" />
          <span className="text-xl font-bold text-[#4C1D95]">
            Atrium<span className="text-[#A855F7]">One</span>
          </span>
        </Link>

        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Inscription</p>
          <h1 className="text-2xl font-bold">Créer votre espace</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B617F]">Après création du compte, vous pourrez renseigner votre commerce.</p>
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
            Ajoutez les variables Supabase dans `.env.local` pour activer l'inscription.
          </div>
        ) : null}

        <div className="space-y-2">
          <GoogleLoginButton href="/auth/google?next=/onboarding" label="Créer un compte avec Google" />
          <p className="text-xs text-[#8B7AA8]">
            Si votre adresse Google n’a pas encore de compte AtriumOne, il sera créé automatiquement.
          </p>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-[#8B7AA8]">
          <span className="h-px flex-1 bg-[#E9D5FF]" />
          ou par email
          <span className="h-px flex-1 bg-[#E9D5FF]" />
        </div>

        <form action={signup} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Email professionnel</span>
            <input name="email" type="email" required placeholder="contact@maisonlavigne.fr" className="w-full rounded-lg border border-[#E9D5FF] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#8B7AA8] focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Mot de passe</span>
            <input name="password" type="password" required minLength={8} placeholder="8 caractères minimum" className="w-full rounded-lg border border-[#E9D5FF] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#8B7AA8] focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
          </label>
          <button type="submit" className="flex w-full items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
            Créer le compte
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#6B617F]">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-semibold text-[#4C1D95] underline">
            Se connecter
          </Link>
        </p>
      </section>
    </main>
  );
}
