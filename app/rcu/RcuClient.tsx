"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { HansAvatar } from "@/components/hans-avatar";
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
import type { CustomerRow, MerchantRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";
import { RcuGameConfigFields } from "./RcuGameConfigFields";
import { RcuRaffleControl } from "./RcuRaffleControl";
import { RcuVisitCodeControl } from "./RcuVisitCodeControl";

function getTypeBadgeClass(formType: string) {
  if (formType === "wheel") return badgeStyles.warning;
  if (formType === "points" || formType === "smart_hans") return badgeStyles.hans;
  return badgeStyles.neutral;
}

export function RcuClient({
  merchant,
  customers: initialCustomers,
  forms: initialForms
}: {
  merchant?: MerchantRow | null;
  customers: CustomerRow[];
  forms: RcuProgram[];
}) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [creatingForm, setCreatingForm] = useState(false);
  const [creatingPosterId, setCreatingPosterId] = useState<string | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
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
  const latestForm = forms[0] ?? null;

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setForms(initialForms);
  }, [initialForms]);

  useEffect(() => {
    function refreshAfterSubmission(event: StorageEvent) {
      if (event.key === "atriumone:rcu-submitted") router.refresh();
    }
    window.addEventListener("storage", refreshAfterSubmission);
    return () => {
      window.removeEventListener("storage", refreshAfterSubmission);
    };
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
    const generated = slugifyRcuValue(title) || getRcuDefaultDraft(formType, merchant?.business_name).slug;
    setFormSlug(generated);
  }

  async function createForm() {
    setCreatingForm(true);
    showToast(editingFormId ? "Mise à jour du RCU..." : "Enregistrement du RCU en cours...", "saving");

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
          game_config: gameConfig
        })
      });
      const data = (await response.json()) as { form?: RcuProgram; error?: string };

      if (!response.ok || !data.form) {
        throw new Error(data.error ?? "Impossible de créer le formulaire.");
      }

      setForms((current) => [data.form!, ...current.filter((form) => form.id !== data.form!.id)]);
      showToast(editingFormId ? "RCU mis à jour avec succès" : "RCU enregistré avec succès", "success");
      setEditingFormId(null);
    } catch (error) {
      showToast(getUserErrorMessage(error), "error");
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingFormId(null);
    setFormType((current) => current);
  }

  async function createPoster(form: RcuProgram) {
    setCreatingPosterId(form.id);
    showToast("Hans prépare l’affiche dans le studio Instagram...", "saving");
    try {
      const response = await fetchWithTimeout(`/api/rcu/forms/${form.slug}/poster-draft`, { method: "POST" }, 30000);
      const data = (await response.json()) as { post?: { id: string }; error?: string };
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
    <div className={appShellStyles.width}>
      <section className={surfaceStyles.hero}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className={`${typographyStyles.kicker} mb-2`}>Référentiel Client Unique</p>
            <h1 className={typographyStyles.h1}>Créez des QR codes RCU prêts à afficher en boutique.</h1>
            <p className={`${typographyStyles.body} mt-2`}>
              Lancez un programme de points, une roue, une tombola, une carte de visites ou une fidélité intelligente, puis laissez Hans préparer l’affiche avec son QR code.
            </p>
          </div>
          {latestForm ? (
            <button type="button" onClick={() => void createPoster(latestForm)} disabled={creatingPosterId === latestForm.id} className={buttonStyles.primary}>
              {creatingPosterId === latestForm.id ? "Hans prépare l’affiche..." : "Créer une affiche"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className={surfaceStyles.kpi}>
          <div className={typographyStyles.kicker}>RCU actifs</div>
          <div className="mt-3 text-[30px] font-black tracking-[-0.04em] text-[var(--color-text)]">
            {forms.filter((form) => form.is_active).length}
          </div>
          <p className={`${typographyStyles.body} mt-2`}>QR codes déployés en boutique.</p>
        </article>
        <article className={surfaceStyles.kpi}>
          <div className={typographyStyles.kicker}>Types disponibles</div>
          <div className="mt-3 text-[30px] font-black tracking-[-0.04em] text-[var(--color-text)]">{RCU_TYPE_DEFINITIONS.length}</div>
          <p className={`${typographyStyles.body} mt-2`}>Points, roue, tombola, visites et Hans IA.</p>
        </article>
        <article className={surfaceStyles.kpi}>
          <div className={typographyStyles.kicker}>Clients collectés</div>
          <div className="mt-3 text-[30px] font-black tracking-[-0.04em] text-[var(--color-text)]">{initialCustomers.length}</div>
          <p className={`${typographyStyles.body} mt-2`}>Contacts centralisés dans votre RCU.</p>
        </article>
        <article className={surfaceStyles.kpi}>
          <div className={typographyStyles.kicker}>Contacts consentis</div>
          <div className="mt-3 text-[30px] font-black tracking-[-0.04em] text-[var(--color-text)]">
            {initialCustomers.filter((customer) => customer.opt_in_sms && !customer.sms_unsubscribed).length}
          </div>
          <p className={`${typographyStyles.body} mt-2`}>Contacts ayant validé le formulaire de la boutique.</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className={surfaceStyles.section}>
          <div className="mb-4 flex items-center gap-3">
            <span className={surfaceStyles.icon}>
              <Icon name="document" className="h-5 w-5" />
            </span>
            <div>
              <h2 className={typographyStyles.h2}>Créer un RCU</h2>
              <p className={`${typographyStyles.body} mt-1`}>Choisissez l’objectif, ajustez le message, puis générez le QR et l’affiche.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {RCU_TYPE_DEFINITIONS.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFormType(type.id)}
                className={`rounded-[20px] border px-4 py-4 text-left transition ${
                  formType === type.id
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-[var(--color-text)]">{type.label}</div>
                  <span className={badgeStyles.neutral}>{type.badge}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{type.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
            <div className="text-sm font-black text-[var(--color-text)]">{selectedType.label}</div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{selectedType.description}</p>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              value={formTitle}
              onChange={(event) => {
                setFormTitle(event.target.value);
                if (!editingFormId) autoGenerateSlug(event.target.value);
              }}
              className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm"
              placeholder="Titre du formulaire"
            />
            <textarea
              value={formIncentive}
              onChange={(event) => setFormIncentive(event.target.value)}
              rows={3}
              className="ao-input ao-focus w-full resize-none px-3.5 py-2.5 text-sm"
              placeholder="Promesse affichée au client"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={ctaLabel}
                onChange={(event) => setCtaLabel(event.target.value)}
                className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm"
                placeholder="Texte du bouton public"
              />
              <input
                value={formSlug}
                onChange={(event) => setFormSlug(slugifyRcuValue(event.target.value))}
                disabled={Boolean(editingFormId)}
                className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm"
                placeholder="slug-formulaire"
              />
            </div>

            {selectedType.targetLabel ? (
              <input
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm"
                placeholder={selectedType.targetPlaceholder ?? "https://…"}
              />
            ) : null}

            <RcuGameConfigFields type={formType} config={gameConfig} onChange={setGameConfig} />

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={posterHeadline}
                onChange={(event) => setPosterHeadline(event.target.value)}
                className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm"
                placeholder="Titre de l’affiche"
              />
              <input
                value={successMessage}
                onChange={(event) => setSuccessMessage(event.target.value)}
                className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm"
                placeholder="Message de succès"
              />
            </div>
            <textarea
              value={posterBody}
              onChange={(event) => setPosterBody(event.target.value)}
              rows={3}
              className="ao-input ao-focus w-full resize-none px-3.5 py-2.5 text-sm"
              placeholder="Texte secondaire de l’affiche"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={createForm} disabled={creatingForm} className={`${buttonStyles.primary} disabled:opacity-60`}>
              {creatingForm ? "Enregistrement…" : editingFormId ? "Enregistrer les modifications" : "Enregistrer le RCU"}
            </button>
            {editingFormId ? <button type="button" onClick={cancelEditing} className={buttonStyles.tertiary}>Annuler</button> : null}
          </div>
        </section>

        <section className={surfaceStyles.section}>
          <h2 className={typographyStyles.h2}>Aperçu QR en boutique</h2>
          <p className={`${typographyStyles.body} mt-1`}>Le QR ouvre l’expérience brandée de la boutique et enregistre chaque participation dans le journal client.</p>
          {latestForm ? (
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              <img
                src={buildRcuQrApiUrl(appOrigin, latestForm.slug, 320)}
                alt="QR code du formulaire RCU"
                className="h-[190px] w-[190px] rounded-[20px] border border-[var(--color-border)] bg-white p-3"
              />
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={getTypeBadgeClass(latestForm.form_type)}>{getRcuTypeDefinition(latestForm.form_type).shortLabel}</span>
                  <span className={latestForm.is_active ? badgeStyles.hans : badgeStyles.neutral}>{latestForm.is_active ? "Actif" : "Inactif"}</span>
                </div>
                <h3 className={typographyStyles.h3}>{latestForm.title}</h3>
                <p className={`${typographyStyles.body} mt-2`}>{latestForm.incentive_text}</p>
                <div className="mt-4 flex gap-3 rounded-[16px] border border-[#E9D5FF] bg-[#FBFAFF] p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"><HansAvatar size={30} /></span>
                  <div><div className="text-xs font-black uppercase tracking-[0.08em] text-[#5B2A9E]">Recommandation de Hans</div><p className="mt-1 text-sm text-[#6B617F]">Transformez ce QR en affiche boutique, puis personnalisez-la dans le studio Instagram.</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/rcu/${latestForm.slug}`} target="_blank" rel="noreferrer" className={buttonStyles.secondary}>Voir la landing</Link>
                  <button type="button" onClick={() => void createPoster(latestForm)} disabled={creatingPosterId === latestForm.id} className={buttonStyles.tertiary}>Créer une affiche</button>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${surfaceStyles.empty} mt-4 px-5 py-8 text-center`}>
              <div className={typographyStyles.h3}>Aucun QR code</div>
              <p className={`${typographyStyles.body} mt-2`}>Créez votre premier RCU pour générer le QR et l’affiche.</p>
            </div>
          )}
        </section>
      </section>

      <section className={surfaceStyles.section}>
        <h2 className={typographyStyles.h2}>Tous les RCU</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {forms.map((form) => {
            const type = getRcuTypeDefinition(form.form_type);

            return (
              <article key={form.id} className={`${surfaceStyles.subtle} p-4`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className={typographyStyles.h3}>{form.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={getTypeBadgeClass(form.form_type)}>{type.shortLabel}</span>
                    <span className={form.is_active ? badgeStyles.hans : badgeStyles.neutral}>{form.is_active ? "Actif" : "Inactif"}</span>
                  </div>
                </div>
                <p className={typographyStyles.body}>{form.incentive_text}</p>
                <RcuVisitCodeControl program={form} onUpdated={updateProgram} />
                {form.form_type === "raffle" ? <RcuRaffleControl program={form} /> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/rcu/${form.slug}`} target="_blank" rel="noreferrer" className={buttonStyles.secondary}>Landing</Link>
                  <a href={`${buildRcuQrApiUrl(appOrigin, form.slug, 720)}&download=1`} className={buttonStyles.tertiary}>Télécharger le QR</a>
                  <button type="button" onClick={() => editForm(form)} className={buttonStyles.tertiary}>Modifier</button>
                  <button type="button" onClick={() => void createPoster(form)} disabled={creatingPosterId === form.id} className={buttonStyles.tertiary}>{creatingPosterId === form.id ? "Création..." : "Créer une affiche"}</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Toast toast={toast} />
    </div>
  );
}
