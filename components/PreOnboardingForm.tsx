"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type FormState = {
  businessName: string;
  managerName: string;
  contactEmail: string;
  googleBusinessEmail: string;
  googleBusinessConfirmed: boolean;
  gmailEmail: string;
  gmailSameAsGoogle: boolean;
  gmailConfirmed: boolean;
  instagramBusinessName: string;
  instagramHandle: string;
  instagramProfessionalConfirmed: boolean;
  globalConfirmed: boolean;
};

const initialState: FormState = {
  businessName: "", managerName: "", contactEmail: "", googleBusinessEmail: "", googleBusinessConfirmed: false,
  gmailEmail: "", gmailSameAsGoogle: false, gmailConfirmed: false, instagramBusinessName: "", instagramHandle: "",
  instagramProfessionalConfirmed: false, globalConfirmed: false
};

const stepLabels = ["Commerce", "Google", "Gmail", "Instagram", "Vérification"];

export function PreOnboardingForm({ token }: { token: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const startedAt = useRef(Date.now());
  const [website, setWebsite] = useState("");
  const gmailValue = form.gmailSameAsGoogle ? form.googleBusinessEmail : form.gmailEmail;

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(form.businessName.trim() && form.managerName.trim() && /^\S+@\S+\.\S+$/.test(form.contactEmail));
    if (step === 1) return Boolean(/^\S+@\S+\.\S+$/.test(form.googleBusinessEmail) && form.googleBusinessConfirmed);
    if (step === 2) return Boolean(/^\S+@\S+\.\S+$/.test(gmailValue) && form.gmailConfirmed);
    if (step === 3) return Boolean(form.instagramBusinessName.trim() && form.instagramHandle.trim() && form.instagramProfessionalConfirmed);
    return form.globalConfirmed;
  }, [form, gmailValue, step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function next() {
    if (!canContinue) { setError("Complétez les champs et confirmations demandés pour continuer."); return; }
    setError(null); setStep((value) => Math.min(4, value + 1)); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!canContinue || submitting) return;
    setSubmitting(true); setError(null);
    try {
      const response = await fetch(`/api/public/pre-onboarding/${token}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, gmailEmail: gmailValue, idempotencyKey: idempotencyKey.current, startedAt: startedAt.current, website })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Le formulaire n’a pas pu être envoyé.");
      setSuccess(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Le formulaire n’a pas pu être envoyé."); }
    finally { setSubmitting(false); }
  }

  if (success) return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#F3E8FF_0,#F8F7F4_48%)] px-5 py-10 text-[#211432]">
    <section className="w-full max-w-xl rounded-[28px] border border-[#E8E4DB] bg-white p-8 text-center shadow-[0_24px_70px_rgba(33,20,50,.12)] sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</div>
      <h1 className="mt-6 text-3xl font-black tracking-[-.04em]">Vos informations sont bien envoyées</h1>
      <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-[#6B617F]">L’équipe AtriumOne peut maintenant préparer votre test. Vous serez accompagné pour les connexions : aucun mot de passe ne vous sera demandé ici.</p>
      <Link href="/signup" className="ao-btn-primary mt-7 inline-flex min-h-12 items-center justify-center px-6 text-sm font-black">Créer mon compte AtriumOne</Link>
    </section>
  </main>;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#F3E8FF_0,#F8F7F4_43%)] px-4 py-6 text-[#211432] sm:px-6 sm:py-10">
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2.5"><Image src="/atriumone-logo.webp" alt="AtriumOne" width={38} height={38} className="h-10 w-10 object-contain" priority /><span className="text-lg font-black">Atrium<span className="text-[#8B5CF6]">One</span></span></div>
        <span className="rounded-full border border-[#D8C9F1] bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#6D28D9]">Pré-onboarding test</span>
      </header>

      <section className="overflow-hidden rounded-[28px] border border-[#E8E4DB] bg-white shadow-[0_24px_70px_rgba(33,20,50,.1)]">
        <div className="border-b border-[#EEEAE2] px-5 py-6 sm:px-8">
          <div className="mb-4 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#8B7AA8]"><span>Étape {step + 1} sur 5</span><span>{stepLabels[step]}</span></div>
          <div className="grid grid-cols-5 gap-2">{stepLabels.map((label, index) => <div key={label}><div className={`h-1.5 rounded-full ${index <= step ? "bg-gradient-to-r from-violet-600 to-fuchsia-500" : "bg-[#EEEAE2]"}`} /><span className="mt-2 hidden text-[9px] font-bold text-[#8B7AA8] sm:block">{label}</span></div>)}</div>
        </div>

        <div className="p-5 sm:p-8">
          {step === 0 ? <Step title="Parlons de votre commerce" description="Ces informations nous permettent de préparer votre fiche AtriumOne.">
            <Field label="Nom du commerce"><input autoFocus required value={form.businessName} onChange={(e) => update("businessName", e.target.value)} className="ao-input h-12 px-3" placeholder="Ex : Institut Camille" /></Field>
            <Field label="Prénom et nom du responsable"><input required value={form.managerName} onChange={(e) => update("managerName", e.target.value)} className="ao-input h-12 px-3" placeholder="Ex : Camille Dupont" /></Field>
            <Field label="E-mail de contact"><input required type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} className="ao-input h-12 px-3" placeholder="camille@institut.fr" /></Field>
          </Step> : null}

          {step === 1 ? <Step brand="google" title="Votre fiche Google Business" description="Indiquez l’adresse e-mail qui administre votre fiche Google. Nous ne vous demanderons jamais son mot de passe.">
            <Field label="E-mail Google Business"><input autoFocus required type="email" value={form.googleBusinessEmail} onChange={(e) => update("googleBusinessEmail", e.target.value)} className="ao-input h-12 px-3" placeholder="commerce@gmail.com" /></Field>
            <Check checked={form.googleBusinessConfirmed} onChange={(value) => update("googleBusinessConfirmed", value)}>Je confirme que cette adresse permet d’administrer la fiche Google Business du commerce.</Check>
          </Step> : null}

          {step === 2 ? <Step brand="gmail" title="Votre adresse Gmail" description="Cette adresse servira uniquement à préparer les fonctionnalités e-mail de votre test.">
            <Check checked={form.gmailSameAsGoogle} onChange={(value) => update("gmailSameAsGoogle", value)}>Utiliser la même adresse que pour Google Business</Check>
            {!form.gmailSameAsGoogle ? <Field label="Adresse Gmail"><input autoFocus required type="email" value={form.gmailEmail} onChange={(e) => update("gmailEmail", e.target.value)} className="ao-input h-12 px-3" placeholder="commerce@gmail.com" /></Field> : <div className="rounded-xl bg-[#F8F5FF] p-3 text-sm font-black text-[#6D28D9]">{form.googleBusinessEmail}</div>}
            <Check checked={form.gmailConfirmed} onChange={(value) => update("gmailConfirmed", value)}>Je confirme que cette adresse Gmail appartient au commerce et pourra être connectée pendant l’onboarding.</Check>
          </Step> : null}

          {step === 3 ? <Step brand="instagram" title="Votre compte Instagram professionnel" description="Renseignez le compte utilisé par le commerce. Aucun mot de passe n’est demandé.">
            <Field label="Nom du commerce sur Instagram"><input autoFocus required value={form.instagramBusinessName} onChange={(e) => update("instagramBusinessName", e.target.value)} className="ao-input h-12 px-3" placeholder="Ex : Institut Camille" /></Field>
            <Field label="Identifiant Instagram exact"><div className="relative"><span className="absolute left-3 top-3.5 font-black text-[#8B7AA8]">@</span><input required value={form.instagramHandle.replace(/^@/, "")} onChange={(e) => update("instagramHandle", e.target.value.replace(/^@/, ""))} className="ao-input h-12 w-full pl-8 pr-3" placeholder="institutcamille" /></div></Field>
            <Check checked={form.instagramProfessionalConfirmed} onChange={(value) => update("instagramProfessionalConfirmed", value)}>Je confirme qu’il s’agit d’un compte Instagram professionnel.</Check>
          </Step> : null}

          {step === 4 ? <Step title="Vérifiez vos informations" description="Vous pourrez toujours corriger ces informations avec l’équipe AtriumOne.">
            <div className="divide-y divide-[#EEEAE2] rounded-2xl border border-[#E8E4DB]">{[
              ["Commerce", form.businessName], ["Responsable", form.managerName], ["Contact", form.contactEmail],
              ["Google Business", form.googleBusinessEmail], ["Gmail", gmailValue], ["Instagram", `@${form.instagramHandle.replace(/^@/, "")}`]
            ].map(([label, value]) => <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr]"><span className="text-[10px] font-black uppercase tracking-wide text-[#8B7AA8]">{label}</span><span className="break-all text-sm font-black">{value}</span></div>)}</div>
            <Check checked={form.globalConfirmed} onChange={(value) => update("globalConfirmed", value)}>Je confirme l’exactitude de ces informations et autorise AtriumOne à les utiliser pour préparer mon test.</Check>
            <p className="text-[11px] font-semibold leading-5 text-[#8B7AA8]">En envoyant ce formulaire, vous acceptez notre <Link href="/confidentialite" target="_blank" className="font-black text-[#6D28D9] underline">politique de confidentialité</Link>.</p>
          </Step> : null}

          <label className="absolute -left-[10000px]" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          {error ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
          <div className="mt-7 flex items-center justify-between gap-3">
            {step > 0 ? <button type="button" onClick={() => { setError(null); setStep(step - 1); }} className="ao-btn-secondary min-h-11 px-4 text-sm font-black">Retour</button> : <span />}
            {step < 4 ? <button type="button" onClick={next} className="ao-btn-primary min-h-11 px-5 text-sm font-black">Continuer</button> : <button type="button" disabled={!canContinue || submitting} onClick={() => void submit()} className="ao-btn-primary min-h-11 px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Envoi…" : "Envoyer mes informations"}</button>}
          </div>
        </div>
      </section>
      <p className="mt-5 text-center text-[11px] font-semibold text-[#8B7AA8]">Vos informations restent réservées à la préparation de votre espace AtriumOne.</p>
    </div>
  </main>;
}

function Step({ title, description, brand, children }: { title: string; description: string; brand?: "google" | "gmail" | "instagram"; children: React.ReactNode }) {
  return <div><div className="flex items-start gap-3">{brand ? <BrandIcon brand={brand} /> : null}<div><h1 className="text-2xl font-black tracking-[-.035em] sm:text-3xl">{title}</h1><p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#6B617F]">{description}</p></div></div><div className="mt-7 space-y-5">{children}</div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-black text-[#3B2B50]">{label}</span>{children}</label>; }
function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) { return <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E8E4DB] bg-[#FCFBF8] p-3.5"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#6D28D9]" /><span className="text-xs font-bold leading-5 text-[#5F5472]">{children}</span></label>; }
function BrandIcon({ brand }: { brand: "google" | "gmail" | "instagram" }) {
  if (brand === "google") return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E8E4DB] bg-white text-xl font-black"><span className="text-[#4285F4]">G</span></div>;
  if (brand === "gmail") return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E8E4DB] bg-white text-xl">✉️</div>;
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-xl text-white">◎</div>;
}
