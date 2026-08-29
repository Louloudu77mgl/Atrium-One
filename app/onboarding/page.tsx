import Link from "next/link";
import { redirect } from "next/navigation";
import { HansAvatar } from "@/components/hans-avatar";
import { LogoUploadField } from "@/components/LogoUploadField";
import { createMerchant } from "@/lib/merchant-actions";
import { isDemoMode } from "@/lib/demo-mode";
import { getMerchant } from "@/lib/merchants";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

const steps = [
  {
    title: "Commerce",
    text: "Renseignez le nom, la catégorie et la ville de l'établissement."
  },
  {
    title: "Contact",
    text: "Ajoutez un téléphone pour préparer les prochains workflows clients."
  },
  {
    title: "Hans",
    text: "La description courte aidera Hans à personnaliser les réponses."
  }
];

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  if (hasSupabaseEnv() && !isDemoMode()) {
    const user = await getCurrentUser();

    if (!user) {
      redirect("/login");
    }

    const merchant = await getMerchant();

    if (merchant) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#F3E8FF_0,#FBFAFF_42%,#FFFFFF_100%)] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="mb-10 inline-flex items-center gap-2.5">
          <img src="/atriumone-logo.webp" alt="AtriumOne" className="h-[42px] w-[42px] object-contain drop-shadow-sm" />
          <span className="text-xl font-bold text-[#4C1D95]">
            Atrium<span className="text-[#A855F7]">One</span>
          </span>
        </Link>

        <section className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.9px] text-[#8B7AA8]">Onboarding</p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight text-[#211432]">Préparer l'espace commerçant.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B617F]">Ces informations créent le merchant lié à votre utilisateur Supabase.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-[14px] border border-[#E9D5FF] bg-white p-5 shadow-[0_1px_4px_rgba(76,29,149,0.07)]">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#4C1D95] text-sm font-bold text-white">
                {step.title === "Hans" ? <HansAvatar size={32} /> : index + 1}
              </div>
              <h2 className="mb-2 text-base font-bold">{step.title}</h2>
              <p className="text-sm leading-6 text-[#6B617F]">{step.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-[14px] border border-[#E9D5FF] bg-white p-5">
          {params?.error ? (
            <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#DC2626]">
              {params.error}
            </div>
          ) : null}

          {!hasSupabaseEnv() ? (
            <div className="mb-4 rounded-lg border border-[#DDD6FE] bg-[#F5F0FF] px-3.5 py-2.5 text-sm text-[#6B617F]">
              Ajoutez les variables Supabase dans `.env.local` pour enregistrer ce formulaire.
            </div>
          ) : null}

          {isDemoMode() ? (
            <div className="mb-4 rounded-lg border border-[#DDD6FE] bg-[#F5F0FF] px-3.5 py-2.5 text-sm text-[#6B617F]">
              Mode démo local : ce formulaire n'enregistre rien dans Supabase et ouvre le dashboard avec les faux avis.
            </div>
          ) : null}

          <form action={createMerchant}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Nom du commerce</span>
                <input name="business_name" required placeholder="Ex. Boulangerie Martin" className="w-full rounded-lg border border-[#E9D5FF] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Catégorie</span>
                <input name="business_type" required placeholder="Ex. Boulangerie, restaurant, institut…" className="w-full rounded-lg border border-[#E9D5FF] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Ville</span>
                <input name="city" required placeholder="Ex. Lyon" className="w-full rounded-lg border border-[#E9D5FF] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Téléphone</span>
                <input name="phone" type="tel" placeholder="04 00 00 00 00" className="w-full rounded-lg border border-[#E9D5FF] px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#8B7AA8] focus:border-[#4C1D95]" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-[#6B617F]">Description courte</span>
                <textarea name="description" rows={4} placeholder="Décrivez en quelques mots ce qui fait la singularité de votre commerce." className="w-full resize-y rounded-lg border border-[#E9D5FF] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#4C1D95] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]" />
              </label>
              <LogoUploadField businessName="Votre commerce" />
            </div>
            <div className="mt-5 flex justify-end">
              <button type="submit" className="rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9]">
                Continuer vers le dashboard
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
