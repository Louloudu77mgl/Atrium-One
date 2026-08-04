"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createRcuPosterDocument } from "@/lib/rcu";
import { renderDocumentToDataUrl } from "@/lib/social-editor/export";
import type { EditorFormat, ExportSettings } from "@/lib/social-editor/types";
import { buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import type { MerchantBrandSettingsRow, MerchantRow, RcuFormRow } from "@/lib/supabase/types";

const FORMAT_OPTIONS: Array<{ id: EditorFormat; label: string; description: string }> = [
  { id: "portrait", label: "Affiche portrait", description: "Le plus adapté pour une vitrine, un comptoir ou un chevalet." },
  { id: "square", label: "Visuel carré", description: "Pratique pour une impression compacte ou un repost sur les réseaux." },
  { id: "story", label: "Format story", description: "Utile pour réutiliser le visuel en story ou écran vertical." }
];

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
  const [format, setFormat] = useState<EditorFormat>("portrait");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);

  const document = useMemo(
    () => createRcuPosterDocument({ form, origin, merchant, brandSettings, format }),
    [brandSettings, form, format, merchant, origin]
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
        fileName: `rcu-${form.slug}-${format}.png`,
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

      <section className="grid gap-6 xl:grid-cols-[0.38fr_0.62fr]">
        <section className={surfaceStyles.section}>
          <h3 className={typographyStyles.h3}>Formats</h3>
          <div className="mt-4 grid gap-3">
            {FORMAT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFormat(option.id)}
                className={`rounded-[20px] border px-4 py-4 text-left transition ${
                  option.id === format
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/40"
                }`}
              >
                <div className="text-sm font-black text-[var(--color-text)]">{option.label}</div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{option.description}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
            <div className="text-sm font-black text-[var(--color-text)]">Conseil boutique</div>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Utilisez le format portrait pour une impression caisse ou vitrine, puis le carré pour republier le même message sur Instagram ou WhatsApp.
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
