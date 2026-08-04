import Link from "next/link";
import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";

export function EmptyDashboardState() {
  return (
    <section className="mb-7 overflow-hidden rounded-[24px] border border-[#E9D5FF] bg-white shadow-[0_18px_45px_rgba(76,29,149,0.08)]">
      <div className="bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] px-6 py-7 text-white">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white shadow-sm">
            <HansAvatar size={48} />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Bienvenue</div>
            <h2 className="text-2xl font-black">Bienvenue sur AtriumOne.</h2>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-white/70">
          Connectez votre fiche Google, synchronisez vos premiers avis, puis laissez Hans préparer des réponses humaines et professionnelles.
        </p>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-3">
        {[
          ["1", "Configurez votre commerce", "Centralisez identité, ton Hans et charte sociale dans Paramètres.", "/settings"],
          ["2", "Préparez la suite Google", "La synchronisation des avis reviendra dans une étape suivante.", "/settings"],
          ["3", "Laissez Hans préparer vos réponses", "Générez des réponses prêtes à valider dès l'arrivée des avis.", "/reviews"]
        ].map(([step, title, body, href]) => (
          <Link key={step} href={href} className="group rounded-[18px] border border-[#E9D5FF] bg-[#FBFAFF] p-4 transition duration-300 hover:-translate-y-1 hover:border-[#D8B4FE] hover:bg-[#F5F0FF] hover:shadow-[0_12px_30px_rgba(76,29,149,0.10)]">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F3E8FF] text-sm font-black text-[#7C3AED] transition group-hover:scale-105">{step}</div>
            <h3 className="text-sm font-black text-[#211432]">{title}</h3>
            <p className="mt-2 text-xs leading-5 text-[#6B617F]">{body}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED]">
              Continuer <Icon name="link" className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
