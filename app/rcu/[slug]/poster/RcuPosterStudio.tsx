"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createRcuPosterDocument } from "@/lib/rcu";
import { renderDocumentToDataUrl } from "@/lib/social-editor/export";
import type { ExportSettings } from "@/lib/social-editor/types";
import { buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import type { MerchantBrandSettingsRow, MerchantRow, RcuFormRow } from "@/lib/supabase/types";

export function RcuPosterStudio({
  form,
  origin,
  merchant,
  brandSettings
}: {
  form: Pick<
    RcuFormRow,
    | "slug"
    | "title"
    | "incentive_text"
    | "discount_label"
    | "discount_value"
    | "form_type"
    | "cta_label"
    | "poster_headline"
    | "poster_body"
  >;
  origin: string;
  merchant?: MerchantRow | null;
  brandSettings?: MerchantBrandSettingsRow | null;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);

  const document = useMemo(
    () => createRcuPosterDocument({ form, origin, merchant, brandSettings, format: "a4" }),
    [brandSettings, form, merchant, origin]
  );

  useEffect(() => {
    let active = true;
    setRendering(true);
    setRenderError(null);
    const settings: ExportSettings = {
      format: "png",
      jpegQuality: 0.92,
      fileName: "rcu-preview.png",
      transparentBackground: false
    };

    void renderDocumentToDataUrl(document, settings)
      .then((url) => {
        if (active) {
          setPreviewUrl(url);
        }
      })
      .catch((error) => {
        if (active) {
          setPreviewUrl(null);
          setRenderError(error instanceof Error ? error.message : "Impossible de générer l’affiche.");
        }
      })
      .finally(() => {
        if (active) {
          setRendering(false);
        }
      });

    return () => {
      active = false;
    };
  }, [document]);

  async function downloadPng() {
    setExporting(true);
    try {
      const settings: ExportSettings = {
        format: "png",
        jpegQuality: 0.92,
        fileName: `affiche-rcu-${form.slug}-a4.png`,
        transparentBackground: false
      };
      const url = await renderDocumentToDataUrl(document, settings);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = settings.fileName;
      link.click();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={surfaceStyles.section}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className={typographyStyles.h2}>Studio affiche RCU</h2>
            <p className={`${typographyStyles.body} mt-1`}>
              Le visuel réutilise le moteur de design social pour produire une affiche propre, exportable et réutilisable.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadPng} disabled={exporting || rendering} className={buttonStyles.primary}>
              {exporting ? "Export…" : "Télécharger en PNG"}
            </button>
            <button type="button" onClick={() => window.print()} className={buttonStyles.secondary}>
              Imprimer
            </button>
            <Link href={`/rcu/${form.slug}`} className={buttonStyles.tertiary}>
              Ouvrir la landing
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <section className={surfaceStyles.section}>
          <div className="inline-flex rounded-full bg-[#F0E8FF] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#5B2A9E]">Affiche RCU · A4</div>
          <h3 className={`${typographyStyles.h3} mt-4`}>Prête à imprimer</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">Le format est verrouillé en A4 pour garantir une impression nette en vitrine, sur comptoir ou près de la caisse.</p>
          <div className="mt-6 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
            <div className="text-sm font-black text-[var(--color-text)]">Support d’impression uniquement</div>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Cette affiche ne peut ni être planifiée ni être publiée sur Instagram. Elle reste modifiable et téléchargeable depuis vos designs.
            </p>
          </div>
        </section>

        <section className={surfaceStyles.section}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className={typographyStyles.h3}>Prévisualisation</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Aperçu du visuel généré à partir du moteur de design social.</p>
            </div>
          </div>
          <div className="rounded-[32px] bg-[var(--color-surface-subtle)] p-4">
            {rendering ? (
              <div className="flex min-h-[540px] items-center justify-center rounded-[28px] bg-white text-sm font-semibold text-[var(--color-text-muted)]">
                Génération de l’aperçu…
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Prévisualisation de l’affiche RCU" className="mx-auto max-h-[760px] rounded-[28px] border border-[var(--color-border)] bg-white shadow-[0_20px_60px_rgba(33,20,50,0.14)]" />
            ) : (
              <div className="flex min-h-[540px] items-center justify-center rounded-[28px] bg-white text-sm font-semibold text-[var(--color-text-muted)]">
                {renderError ?? "Impossible d’afficher l’aperçu."}
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
