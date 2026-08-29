import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { HansAvatar } from "@/components/hans-avatar";
import { login } from "@/lib/auth/actions";
import { mapLoginPageErrorMessage } from "@/lib/auth/google-login";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { isCrmAdminEmail } from "@/lib/crm/access";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = mapLoginPageErrorMessage(params?.error);

  if (hasSupabaseEnv()) {
    const user = await getCurrentUser();

    if (user) {
      redirect(isCrmAdminEmail(user.email) ? "/crm" : "/dashboard");
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
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Connexion</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E9D5FF] bg-white shadow-sm">
              <HansAvatar size={34} />
            </span>
            Retrouvez Hans
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6B617F]">Connectez-vous pour accéder au dashboard de votre commerce.</p>
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
            Ajoutez les variables Supabase dans `.env.local` pour activer l'authentification.
          </div>
        ) : null}

        {isDemoMode() ? (
          <div className="mb-4 rounded-lg border border-[#DDD6FE] bg-[#F5F0FF] px-3.5 py-2.5 text-sm text-[#6B617F]">
            Mode démo local actif : les faux avis sont visibles sans connexion.{" "}
            <Link href="/dashboard" className="font-semibold text-[#4C1D95] underline">
              Ouvrir le dashboard de test
            </Link>
          </div>
        ) : null}

        <div className="space-y-2">
          <GoogleLoginButton />
          <p className="text-xs text-[#8B7AA8]">
            Cette connexion sert uniquement à entrer dans AtriumOne, pas à connecter Google Business Profile.
          </p>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-[#8B7AA8]">
          <span className="h-px flex-1 bg-[#E9D5FF]" />
          ou par email
          <span className="h-px flex-1 bg-[#E9D5FF]" />
        </div>

        <form action={login} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Email professionnel</span>
            <input name="email" type="email" required placeholder="contact@maisonlavigne.fr" className="w-full rounded-lg border border-[#E9D5FF] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#8B7AA8] focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Mot de passe</span>
            <input name="password" type="password" required placeholder="••••••••" className="w-full rounded-lg border border-[#E9D5FF] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#8B7AA8] focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
          </label>
          <div className="-mt-1 text-right">
            <Link href="/forgot-password" className="text-xs font-semibold text-[#4C1D95] underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <button type="submit" className="flex w-full items-center justify-center rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
            Se connecter
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#6B617F]">
          Nouveau commerce ?{" "}
          <Link href="/signup" className="font-semibold text-[#4C1D95] underline">
            Créer un compte
          </Link>
        </p>
      </section>
    </main>
  );
}
