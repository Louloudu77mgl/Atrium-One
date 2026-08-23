"use client";

import { useState } from "react";
import { SocialAutomationPanel } from "./SocialAutomationPanel";
import { buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import type { Review } from "@/lib/mock-data";
import type { GoogleConnectionRow, InstagramConnectionRow, MerchantAutomationSettingsRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";

type ReviewMode = "disabled" | "semi_automatic" | "automatic_guarded";
const reviewOptions: Array<[ReviewMode, string, string]> = [
  ["disabled", "Désactivée", "Aucune réponse automatique."],
  ["semi_automatic", "Validation requise", "Hans prépare les réponses ; vous publiez."],
  ["automatic_guarded", "Automatique sécurisée", "Publication automatique uniquement pour les avis éligibles."]
];

export function AutomationsClient({ merchant, reviews, settings, googleConnection, instagramConnection, socialPosts }: {
  merchant: MerchantRow | null;
  reviews: Review[];
  settings: MerchantAutomationSettingsRow | null;
  googleConnection: GoogleConnectionRow | null;
  instagramConnection: InstagramConnectionRow | null;
  socialPosts: SocialPostRow[];
}) {
  const [reviewMode, setReviewMode] = useState<ReviewMode>(settings?.review_automation_mode ?? "disabled");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const googleReady = googleConnection?.status === "connected";
  const instagramReady = instagramConnection?.status === "connected";
  const reviewEnabled = reviewMode !== "disabled";
  const socialEnabled = settings?.social_auto_publish_enabled === true;
  const activeCount = Number(reviewEnabled) + Number(socialEnabled);

  async function saveReviewAutomation(nextMode: ReviewMode) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/settings/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_automation_mode: nextMode, reviews_auto_reply_enabled: nextMode !== "disabled" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Impossible d’enregistrer l’automatisation.");
      setReviewMode(nextMode);
      setNotice(nextMode === "disabled" ? "Réponses automatiques désactivées." : "Réglages de réponses enregistrés.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer l’automatisation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 pb-16">
      <section className={`${surfaceStyles.hero} p-6 md:p-7`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl"><p className={`${typographyStyles.kicker} mb-2`}>Automatisations</p><h1 className={typographyStyles.h1}>Ce que Hans peut vraiment faire pour vous.</h1><p className={`${typographyStyles.body} mt-3`}>Activez uniquement des scénarios reliés à vos comptes. Chaque réglage est sauvegardé dans votre espace et appliqué par les tâches planifiées.</p></div>
          <span className={reviewEnabled || socialEnabled ? "ao-badge ao-badge-hans" : "ao-badge ao-badge-neutral"}>{activeCount} automatisation{activeCount > 1 ? "s" : ""} active{activeCount > 1 ? "s" : ""}</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className={surfaceStyles.kpi}><div className={typographyStyles.kicker}>Avis Google</div><div className="mt-3 text-2xl font-black text-[var(--color-text)]">{googleReady ? (reviewEnabled ? "Active" : "Prête") : "À connecter"}</div><p className={[typographyStyles.body, "mt-2"].join(" ")}>{googleReady ? reviews.length + " avis visibles dans AtriumOne." : "La connexion Google est nécessaire."}</p></article>
        <article className={surfaceStyles.kpi}><div className={typographyStyles.kicker}>Instagram</div><div className="mt-3 text-2xl font-black text-[var(--color-text)]">{instagramReady ? (socialEnabled ? "Active" : "Prêt") : "À connecter"}</div><p className={[typographyStyles.body, "mt-2"].join(" ")}>{socialPosts.filter((post) => post.source === "automation").length} post(s) issus de l’automatisation.</p></article>
        <article className={surfaceStyles.kpi}><div className={typographyStyles.kicker}>Exécution</div><div className="mt-3 text-2xl font-black text-[var(--color-text)]">Quotidienne</div><p className={[typographyStyles.body, "mt-2"].join(" ")}>Les tâches planifiées sont exécutées par le cron de production.</p></article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className={[surfaceStyles.section, "p-6"].join(" ")}>
          <p className={[typographyStyles.kicker, "mb-2"].join(" ")}>Réponses aux avis</p><h2 className={typographyStyles.h2}>Répondre aux nouveaux avis Google</h2><p className={[typographyStyles.body, "mt-2"].join(" ")}>Hans génère une réponse. Les avis sensibles et négatifs restent systématiquement à valider.</p>
          {!googleReady ? <div className={[surfaceStyles.empty, "mt-5 p-4 text-sm text-[var(--color-text-muted)]"].join(" ")}>Connectez Google Business dans Intégrations avant d’activer cette automatisation.</div> : null}
          <fieldset disabled={saving || !googleReady} className="mt-5 grid gap-2">
            {reviewOptions.map(([value, label, description]) => (
              <label key={value} className={["flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-4 transition", reviewMode === value ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)]" : "border-[var(--color-border)] bg-white"].join(" ")}>
                <input type="radio" name="review-mode" checked={reviewMode === value} onChange={() => setReviewMode(value)} className="mt-1 accent-[var(--color-primary)]" />
                <span><strong className="text-sm text-[var(--color-text)]">{label}</strong><span className="mt-1 block text-sm text-[var(--color-text-muted)]">{description}</span></span>
              </label>
            ))}
          </fieldset>
          <div className="mt-5 flex items-center gap-3"><button type="button" disabled={saving || !googleReady} onClick={() => void saveReviewAutomation(reviewMode)} className={[buttonStyles.primary, "disabled:opacity-50"].join(" ")}>{saving ? "Enregistrement…" : "Enregistrer"}</button>{notice ? <span className="text-sm font-semibold text-[var(--color-success)]">{notice}</span> : null}</div>{error ? <p className="mt-3 text-sm font-semibold text-[var(--color-danger)]">{error}</p> : null}
        </section>
        <SocialAutomationPanel initialSettings={settings} initialPosts={socialPosts} businessType={merchant?.business_type} />
      </section>
    </div>
  );
}
