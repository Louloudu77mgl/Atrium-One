import Link from "next/link";

export const metadata = { title: "Confidentialité | AtriumOne" };

export default function PrivacyPage() {
  return <main className="min-h-screen bg-[#F8F7F4] px-5 py-12 text-[#211432]">
    <article className="mx-auto max-w-2xl rounded-3xl border border-[#E8E4DB] bg-white p-7 shadow-sm sm:p-10">
      <Link href="/" className="text-sm font-black text-[#6D28D9]">AtriumOne</Link>
      <h1 className="mt-5 text-3xl font-black tracking-[-.04em]">Confidentialité du pré-onboarding</h1>
      <div className="mt-6 space-y-5 text-sm font-medium leading-7 text-[#5F5472]">
        <p>Les informations renseignées dans le formulaire sont utilisées uniquement pour préparer votre test AtriumOne et configurer, avec votre accord, les connexions Google Business, Gmail et Instagram nécessaires.</p>
        <p>Elles sont accessibles à l’administrateur AtriumOne chargé de votre onboarding. AtriumOne ne vous demandera jamais votre mot de passe dans ce formulaire.</p>
        <p>Vous pouvez demander l’accès, la rectification ou la suppression de ces informations en écrivant à <a className="font-black text-[#6D28D9]" href="mailto:louisdacre@gmail.com">louisdacre@gmail.com</a>.</p>
      </div>
    </article>
  </main>;
}
