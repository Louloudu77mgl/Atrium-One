"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { HansGeneratingModal } from "@/components/HansGeneratingModal";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import {
  buildRcuQrApiUrl,
  getDefaultRcuGameConfig,
  getRcuDefaultDraft,
  getRcuTypeDefinition,
  RCU_TYPE_DEFINITIONS,
  type RcuFormType,
  type RcuGameConfig,
  type RcuProgram,
  slugifyRcuValue
} from "@/lib/rcu";
import { appShellStyles, badgeStyles, buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { RcuCustomerRow } from "@/lib/rcu-store";
import type { MerchantRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";
import { RcuGameConfigFields } from "./RcuGameConfigFields";
import { RcuRaffleControl } from "./RcuRaffleControl";
import { RcuVisitCodeControl } from "./RcuVisitCodeControl";

function getTypeBadgeClass(formType: string) {
  if (formType === "wheel") return badgeStyles.warning;
  if (formType === "points" || formType === "smart_hans") return badgeStyles.hans;
  return badgeStyles.neutral;
}

export function RcuClient({ merchant, customers: initialCustomers, forms: initialForms }: {
  merchant?: MerchantRow | null;
  customers: RcuCustomerRow[];
  forms: RcuProgram[];
}) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [createOpen, setCreateOpen] = useState(initialForms.length === 0);
  const [creatingForm, setCreatingForm] = useState(false);
  const [creatingPosterId, setCreatingPosterId] = useState<string | null>(null);
  const [updatingFormId, setUpdatingFormId] = useState<string | null>(null);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);
  const [formType, setFormType] = useState<RcuFormType>("points");
  const [formTitle, setFormTitle] = useState("");
  const [formIncentive, setFormIncentive] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [posterHeadline, setPosterHeadline] = useState("");
  const [posterBody, setPosterBody] = useState("");
  const [gameConfig, setGameConfig] = useState<RcuGameConfig>(() => getDefaultRcuGameConfig("points"));
  const [appOrigin, setAppOrigin] = useState("http://localhost:3000");
  const { toast, showToast } = useToast();
  const selectedType = useMemo(() => getRcuTypeDefinition(formType), [formType]);
  const activeCount = forms.filter((form) => form.is_active).length;
  const optedInCustomers = initialCustomers.filter((customer) => customer.opt_in_email || (customer.opt_in_sms && !customer.sms_unsubscribed)).length;

  useEffect(() => setAppOrigin(window.location.origin), []);
  useEffect(() => setForms(initialForms), [initialForms]);
  useEffect(() => {
    function refreshAfterSubmission(event: StorageEvent) {
      if (event.key === "atriumone:rcu-submitted") router.refresh();
    }
    window.addEventListener("storage", refreshAfterSubmission);
    return () => window.removeEventListener("storage", refreshAfterSubmission);
  }, [router]);
  useEffect(() => {
    if (editingFormId) return;
    const defaults = getRcuDefaultDraft(formType, merchant?.business_name);
    setFormTitle(defaults.title);
    setFormIncentive(defaults.incentiveText);
    setFormSlug(defaults.slug);
    setCtaLabel(defaults.ctaLabel);
    setTargetUrl(defaults.targetUrl);
    setSuccessMessage(defaults.successMessage);
    setPosterHeadline(defaults.posterHeadline);
    setPosterBody(defaults.posterBody);
    setGameConfig(defaults.gameConfig);
  }, [editingFormId, formType, merchant?.business_name]);

  function autoGenerateSlug(title: string) {
    setFormSlug(slugifyRcuValue(title) || getRcuDefaultDraft(formType, merchant?.business_name).slug);
  }

  function scrollToEditor() {
    window.setTimeout(() => document.getElementById("rcu-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function startCreating() {
    setEditingFormId(null);
    setFormType("points");
    setAdvancedOptionsOpen(false);
    setCreateOpen(true);
    scrollToEditor();
  }

  async function saveForm() {
    setCreatingForm(true);
    showToast(editingFormId ? "Mise à jour du programme…" : "Création du programme…", "saving");
    const existing = forms.find((form) => form.id === editingFormId);
    try {
      const response = await fetchWithTimeout("/api/rcu/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: formType,
          title: formTitle,
          incentive_text: formIncentive,
          slug: formSlug,
          discount_label: null,
          discount_value: null,
          cta_label: ctaLabel,
          target_url: selectedType.targetLabel ? targetUrl : null,
          success_message: successMessage,
          poster_headline: posterHeadline,
          poster_body: posterBody,
          poster_theme: formType,
          game_config: gameConfig,
          is_active: existing?.is_active ?? true
        })
      });
      const data = await response.json() as { form?: RcuProgram; error?: string };
      if (!response.ok || !data.form) throw new Error(data.error ?? "Impossible d’enregistrer ce RCU.");
      setForms((current) => [data.form!, ...current.filter((form) => form.id !== data.form!.id)]);
      setEditingFormId(null);
      setCreateOpen(false);
      setAdvancedOptionsOpen(false);
      showToast(existing ? "RCU mis à jour" : "RCU créé et activé", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Enregistrement impossible."), "error");
    } finally {
      setCreatingForm(false);
    }
  }

  function editForm(form: RcuProgram) {
    setEditingFormId(form.id);
    setFormType(form.form_type);
    setFormTitle(form.title);
    setFormIncentive(form.incentive_text);
    setFormSlug(form.slug);
    setCtaLabel(form.cta_label ?? getRcuTypeDefinition(form.form_type).defaultCtaLabel);
    setTargetUrl(form.target_url ?? "");
    setSuccessMessage(form.success_message ?? getRcuTypeDefinition(form.form_type).successMessage);
    setPosterHeadline(form.poster_headline ?? getRcuTypeDefinition(form.form_type).defaultPosterHeadline);
    setPosterBody(form.poster_body ?? getRcuTypeDefinition(form.form_type).defaultPosterBody);
    setGameConfig(form.game_config);
    setAdvancedOptionsOpen(false);
    setCreateOpen(true);
    scrollToEditor();
  }

  async function toggleProgram(form: RcuProgram) {
    setUpdatingFormId(form.id);
    try {
      const response = await fetchWithTimeout(`/api/rcu/forms/${form.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !form.is_active })
      });
      const data = await response.json() as { form?: RcuProgram; error?: string };
      if (!response.ok || !data.form) throw new Error(data.error ?? "Modification impossible.");
      setForms((current) => current.map((item) => item.id === form.id ? data.form! : item));
      showToast(data.form.is_active ? "RCU et code commerçant activés" : "RCU désactivé", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Modification impossible."), "error");
    } finally {
      setUpdatingFormId(null);
    }
  }

  async function deleteProgram(form: RcuProgram) {
    const confirmed = window.confirm(`Supprimer « ${form.title} » ?\n\nLe QR ne fonctionnera plus. Les clients et leur historique seront conservés.`);
    if (!confirmed) return;
    setDeletingFormId(form.id);
    try {
      const response = await fetchWithTimeout(`/api/rcu/forms/${form.slug}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Suppression impossible.");
      setForms((current) => current.filter((item) => item.id !== form.id));
      if (editingFormId === form.id) {
        setEditingFormId(null);
        setCreateOpen(false);
      }
      showToast("RCU supprimé. Les clients sont conservés.", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Suppression impossible."), "error");
    } finally {
      setDeletingFormId(null);
    }
  }

  async function createPoster(form: RcuProgram) {
    setCreatingPosterId(form.id);
    showToast("Hans prépare l’affiche…", "saving");
    try {
      const response = await fetchWithTimeout(`/api/rcu/forms/${form.slug}/poster-draft`, { method: "POST" }, 120000);
      const data = await response.json() as { post?: { id: string }; error?: string };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Création de l’affiche impossible.");
      router.push(`/social/editor/${data.post.id}`);
    } catch (error) {
      showToast(getUserErrorMessage(error, "Création de l’affiche impossible."), "error");
      setCreatingPosterId(null);
    }
  }

  function updateProgram(updated: RcuProgram) {
    setForms((current) => current.map((form) => form.id === updated.id ? updated : form));
  }

  return (
    <div className={`${appShellStyles.width} space-y-5`}>
      <section className={surfaceStyles.hero}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className={`${typographyStyles.kicker} mb-2`}>Fidélisation en boutique</p>
            <h1 className={typographyStyles.h1}>Mes programmes RCU</h1>
            <p className={`${typographyStyles.body} mt-2`}>Activez un programme, affichez son QR et validez chaque visite avec votre code commerçant.</p>
          </div>
          <button type="button" onClick={startCreating} className={buttonStyles.primary}>Créer un RCU</button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Programmes actifs" value={activeCount} hint={activeCount ? "QR et codes disponibles" : "Activez votre premier programme"} />
        <SummaryCard label="Clients collectés" value={initialCustomers.length} hint="Historique conservé" />
        <SummaryCard label="Contacts joignables" value={optedInCustomers} hint="Avec leur accord" />
      </section>

      <section className={surfaceStyles.section}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className={typographyStyles.h2}>Vos RCU</h2><p className={`${typographyStyles.body} mt-1`}>Un interrupteur contrôle à la fois le QR public et le code commerçant.</p></div>
          <span className={badgeStyles.neutral}>{forms.length} programme{forms.length > 1 ? "s" : ""}</span>
        </div>

        {forms.length === 0 ? (
          <div className={`${surfaceStyles.empty} mt-5 px-5 py-10 text-center`}>
            <div className={typographyStyles.h3}>Aucun programme pour le moment</div>
            <p className={`${typographyStyles.body} mt-2`}>Créez un RCU : son QR et son code commerçant seront actifs immédiatement.</p>
            <button type="button" onClick={startCreating} className={`${buttonStyles.primary} mt-5`}>Créer mon premier RCU</button>
          </div>
        ) : <div className="mt-5 grid gap-4">{forms.map((form) => {
          const type = getRcuTypeDefinition(form.form_type);
          const busy = updatingFormId === form.id || deletingFormId === form.id;
          return (
            <article key={form.id} className="rounded-[22px] border border-[var(--color-border)] bg-white p-5 shadow-[0_8px_26px_rgba(31,22,43,0.04)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><span className={getTypeBadgeClass(form.form_type)}>{type.shortLabel}</span><span className={form.is_active ? badgeStyles.hans : badgeStyles.neutral}>{form.is_active ? "Actif" : "En pause"}</span></div>
                  <h3 className={typographyStyles.h3}>{form.title}</h3>
                  <p className={`${typographyStyles.body} mt-1 max-w-2xl`}>{form.incentive_text}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[var(--color-text-muted)]">{busy ? "Mise à jour…" : form.is_active ? "Activé" : "Désactivé"}</span>
                  <button type="button" role="switch" aria-checked={form.is_active} aria-busy={busy} disabled={busy} onClick={() => void toggleProgram(form)} className={`ao-toggle ${form.is_active ? "ao-toggle-on" : "ao-toggle-off"} disabled:opacity-60`}><span className={`ao-toggle-thumb ${form.is_active ? "ao-toggle-thumb-on" : "ao-toggle-thumb-off"}`} /></button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
                <div>
                  <div className={`${surfaceStyles.subtle} p-4`}>
                    <div className="flex items-start gap-3"><span className={surfaceStyles.icon}><Icon name={form.is_active ? "check" : "lock"} className="h-4 w-4" /></span><div><div className="text-sm font-black text-[var(--color-text)]">{form.is_active ? "Programme opérationnel" : "Programme en pause"}</div><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{form.is_active ? "Le QR et le code commerçant fonctionnent sans date d’expiration." : "Le QR public est coupé. Réactivez le programme pour remettre le QR et le code en service."}</p></div></div>
                  </div>
                  {form.is_active ? <RcuVisitCodeControl program={form} onUpdated={updateProgram} /> : null}
                  {form.form_type === "raffle" && form.is_active ? <RcuRaffleControl program={form} /> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.is_active ? <Link href={`/rcu/${form.slug}`} target="_blank" rel="noreferrer" className={buttonStyles.secondary}>Ouvrir le RCU</Link> : null}
                    {form.is_active ? <a href={`${buildRcuQrApiUrl(appOrigin, form.slug, 720)}&download=1`} className={buttonStyles.tertiary}>Télécharger le QR</a> : null}
                    <button type="button" onClick={() => editForm(form)} className={buttonStyles.tertiary}>Modifier</button>
                    <button type="button" onClick={() => void createPoster(form)} disabled={!form.is_active || creatingPosterId === form.id} className={`${buttonStyles.tertiary} disabled:opacity-45`}>{creatingPosterId === form.id ? "Création…" : "Créer une affiche"}</button>
                    <button type="button" onClick={() => void deleteProgram(form)} disabled={busy} className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold text-[#B42318] transition hover:bg-[#FFF1F0] disabled:opacity-50">Supprimer</button>
                  </div>
                </div>
                <div className={`rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-center ${form.is_active ? "" : "opacity-45 grayscale"}`}>
                  <img src={buildRcuQrApiUrl(appOrigin, form.slug, 280)} alt={`QR code ${form.title}`} className="mx-auto h-[142px] w-[142px] rounded-[14px] bg-white p-2" />
                  <div className="mt-2 text-xs font-black text-[var(--color-text)]">{form.is_active ? "QR permanent" : "QR en pause"}</div><div className="mt-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">{form.is_active ? "Sans expiration" : "Réactivez le programme"}</div>
                </div>
              </div>
            </article>
          );
        })}</div>}
      </section>

      {createOpen ? (
        <section id="rcu-editor" className={surfaceStyles.section}>
          <div className="flex items-start justify-between gap-4"><div><p className={`${typographyStyles.kicker} mb-2`}>{editingFormId ? "Modification" : "Nouveau programme"}</p><h2 className={typographyStyles.h2}>{editingFormId ? "Modifier ce RCU" : "Créer un RCU"}</h2><p className={`${typographyStyles.body} mt-1`}>Choisissez une mécanique simple, puis personnalisez le message présenté aux clients.</p></div><button type="button" onClick={() => { setCreateOpen(false); setEditingFormId(null); }} className={buttonStyles.tertiary}>Fermer</button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{RCU_TYPE_DEFINITIONS.map((type) => <button key={type.id} type="button" disabled={Boolean(editingFormId)} onClick={() => setFormType(type.id)} className={`rounded-[18px] border p-4 text-left transition disabled:cursor-not-allowed ${formType === type.id ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/40"}`}><div className="text-sm font-black text-[var(--color-text)]">{type.shortLabel}</div><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{type.description}</p></button>)}</div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="text-xs font-bold text-[var(--color-text-muted)]">Nom du programme<input value={formTitle} onChange={(event) => { setFormTitle(event.target.value); if (!editingFormId) autoGenerateSlug(event.target.value); }} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm" /></label>
            <label className="text-xs font-bold text-[var(--color-text-muted)]">Texte du bouton<input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm" /></label>
            <label className="text-xs font-bold text-[var(--color-text-muted)] lg:col-span-2">Promesse faite au client<textarea value={formIncentive} onChange={(event) => setFormIncentive(event.target.value)} rows={3} className="ao-input ao-focus mt-1 w-full resize-none px-3.5 py-2.5 text-sm" /></label>
          </div>
          <button type="button" onClick={() => setAdvancedOptionsOpen((open) => !open)} className={`${buttonStyles.tertiary} mt-4`} aria-expanded={advancedOptionsOpen}>{advancedOptionsOpen ? "Masquer les détails" : "Afficher les détails"}</button>
          {advancedOptionsOpen ? <div className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4">
            <label className="text-xs font-bold text-[var(--color-text-muted)]">Adresse du QR<input value={formSlug} onChange={(event) => setFormSlug(slugifyRcuValue(event.target.value))} disabled={Boolean(editingFormId)} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm disabled:opacity-60" /></label>
            {selectedType.targetLabel ? <label className="text-xs font-bold text-[var(--color-text-muted)]">{selectedType.targetLabel}<input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm" placeholder={selectedType.targetPlaceholder ?? "https://…"} /></label> : null}
            <RcuGameConfigFields type={formType} config={gameConfig} onChange={setGameConfig} />
            <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-bold text-[var(--color-text-muted)]">Titre de l’affiche<input value={posterHeadline} onChange={(event) => setPosterHeadline(event.target.value)} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm" /></label><label className="text-xs font-bold text-[var(--color-text-muted)]">Message après inscription<input value={successMessage} onChange={(event) => setSuccessMessage(event.target.value)} className="ao-input ao-focus mt-1 w-full px-3.5 py-2.5 text-sm" /></label></div>
            <label className="text-xs font-bold text-[var(--color-text-muted)]">Texte de l’affiche<textarea value={posterBody} onChange={(event) => setPosterBody(event.target.value)} rows={3} className="ao-input ao-focus mt-1 w-full resize-none px-3.5 py-2.5 text-sm" /></label>
          </div> : null}
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void saveForm()} disabled={creatingForm || !formTitle.trim() || !formIncentive.trim()} className={`${buttonStyles.primary} disabled:opacity-50`}>{creatingForm ? "Enregistrement…" : editingFormId ? "Enregistrer les modifications" : "Créer et activer"}</button><button type="button" onClick={() => { setCreateOpen(false); setEditingFormId(null); }} className={buttonStyles.tertiary}>Annuler</button></div>
        </section>
      ) : null}

      <HansGeneratingModal open={Boolean(creatingPosterId)} title="Hans crée votre affiche RCU" description="Hans compose une affiche fidèle à votre commerce avec le QR prêt à imprimer." />
      <Toast toast={toast} />
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <article className={`${surfaceStyles.kpi} p-4`}><div className={typographyStyles.kicker}>{label}</div><div className="mt-2 text-[27px] font-black tracking-[-0.04em] text-[var(--color-text)]">{value}</div><p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">{hint}</p></article>;
}
