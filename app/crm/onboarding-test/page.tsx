const googleTestUsersUrl = "https://console.cloud.google.com/auth/audience?project=650116804104";
const metaTestersUrl = "https://developers.facebook.com/apps/1457310063112802/roles/roles/";

const steps = [
  {
    number: "01",
    provider: "Google Business Profile",
    title: "Ajouter l’adresse Google du commerce",
    text: "Récupère l’adresse Google qui possède ou administre la fiche Google Business du commerce.",
    instructions: [
      "Ouvre le lien ci-dessous.",
      "Dans Test users, clique sur Add users.",
      "Colle l’adresse Google du client puis enregistre."
    ],
    cta: "Ajouter le testeur Google Business",
    href: googleTestUsersUrl,
    tone: "from-blue-600 to-cyan-500"
  },
  {
    number: "02",
    provider: "Gmail",
    title: "Ajouter l’adresse Gmail d’envoi",
    text: "Récupère l’adresse Gmail depuis laquelle le commerce enverra ses campagnes AtriumOne.",
    instructions: [
      "Ouvre le même écran Google Test users.",
      "Clique sur Add users.",
      "Colle l’adresse Gmail du client puis enregistre."
    ],
    note: "Si c’est la même adresse que pour Google Business, elle est déjà ajoutée : tu n’as rien à refaire.",
    cta: "Ajouter le testeur Gmail",
    href: googleTestUsersUrl,
    tone: "from-red-500 to-amber-500"
  },
  {
    number: "03",
    provider: "Meta for Developers",
    title: "Ajouter le compte Instagram du commerce",
    text: "Récupère le nom d’utilisateur Instagram professionnel exact du commerce, sans demander son mot de passe.",
    instructions: [
      "Ouvre directement les rôles de l’application AtriumOne.",
      "Ajoute le compte dans la section Instagram testers.",
      "Demande au client d’accepter l’invitation sur son compte Instagram."
    ],
    cta: "Ajouter le testeur Instagram",
    href: metaTestersUrl,
    tone: "from-violet-600 to-fuchsia-500"
  }
] as const;

export default function TestOnboardingPage() {
  return <div>
    <header className="border-b border-[#E8E4DB] bg-white px-5 py-6 lg:px-8">
      <div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B7AA8]">Onboarding clients test</div>
      <h1 className="mt-1 text-2xl font-black tracking-[-.03em]">Les 3 accès à renseigner</h1>
      <p className="mt-1 max-w-2xl text-sm font-semibold text-[#6B617F]">Pendant l’onboarding : récupère l’adresse ou le compte du client, clique sur le bouton correspondant et ajoute-le comme testeur.</p>
    </header>

    <main className="mx-auto max-w-4xl space-y-4 p-5 lg:p-8">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900">À préparer avec le client : son adresse Google Business, son adresse Gmail d’envoi et son @ Instagram professionnel. Aucun mot de passe ni code 2FA.</div>

      {steps.map((step) => <section key={step.number} className="overflow-hidden rounded-2xl border border-[#E8E4DB] bg-white shadow-sm">
        <div className="grid md:grid-cols-[110px_minmax(0,1fr)]">
          <div className={`flex items-center justify-center bg-gradient-to-br ${step.tone} px-4 py-5 text-white md:min-h-[260px] md:flex-col`}><div className="text-[10px] font-black uppercase tracking-[.16em] text-white/70">Étape</div><div className="ml-2 text-3xl font-black md:ml-0 md:mt-1">{step.number}</div></div>
          <div className="p-5 lg:p-6">
            <div className="text-[10px] font-black uppercase tracking-[.12em] text-[#8B7AA8]">{step.provider}</div>
            <h2 className="mt-1 text-lg font-black text-[#211432]">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#6B617F]">{step.text}</p>
            <ol className="mt-4 space-y-2">{step.instructions.map((instruction, index) => <li key={instruction} className="flex gap-2.5 text-xs font-semibold text-[#4B4257]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[10px] font-black text-[#6D28D9]">{index + 1}</span><span className="pt-0.5">{instruction}</span></li>)}</ol>
            {"note" in step ? <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">{step.note}</div> : null}
            <a href={step.href} target="_blank" rel="noreferrer" className="ao-btn-primary mt-5 inline-flex px-4 py-2.5 text-xs font-black">{step.cta} ↗</a>
          </div>
        </div>
      </section>)}
    </main>
  </div>;
}
