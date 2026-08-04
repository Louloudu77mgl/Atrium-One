"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import type { EditorSaveState } from "@/lib/social-editor/types";
import styles from "./editor-shell.module.css";

export function EditorTopBar({
  title,
  zoom,
  onTitleChange,
  saveState,
  saveError,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreview,
  onExport,
  onSave,
  onZoomIn,
  onZoomOut,
  lastSavedAt
}: {
  title: string;
  zoom: number;
  onTitleChange: (value: string) => void;
  saveState: EditorSaveState;
  saveError?: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onExport: () => void;
  onSave: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  lastSavedAt?: string | null;
}) {
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>A</div>
          <div className={styles.brandName}>
            Atrium<span>One</span> Design
          </div>
        </div>
        <div className={styles.dividerV} />
        <Link href="/social" className={styles.iconBtn} title="Retour">
          <Icon name="link" className="h-[18px] w-[18px] rotate-180" />
        </Link>
        <div className={styles.filenameWrap}>
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className={styles.filename}
          />
          <div className={styles.filesub} title={saveError ?? undefined}>
            {formatSaveLabel(saveState, lastSavedAt)}
          </div>
        </div>
      </div>

      <div className={styles.topbarMid}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler"
          aria-label="Annuler"
        >
          <Icon name="refresh" className="h-[18px] w-[18px] rotate-180" />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onRedo}
          disabled={!canRedo}
          title="Rétablir"
          aria-label="Rétablir"
        >
          <Icon name="refresh" className="h-[18px] w-[18px]" />
        </button>
        <div className={styles.dividerV} />
        <div className={styles.zoomGroup}>
          <button
            type="button"
            className={styles.zoomInnerButton}
            onClick={onZoomOut}
            title="Zoom arrière"
            aria-label="Zoom arrière"
          >
            –
          </button>
          <div className={styles.zoomVal}>{Math.round(zoom * 100)}%</div>
          <button
            type="button"
            className={styles.zoomInnerButton}
            onClick={onZoomIn}
            title="Zoom avant"
            aria-label="Zoom avant"
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.topbarRight}>
        <button type="button" className={styles.pillGhost} onClick={onPreview}>
          Prévisualiser
        </button>
        <button type="button" className={styles.pillGhost} onClick={onSave}>
          Enregistrer
        </button>
        <button type="button" className={styles.pillSolid} onClick={onExport}>
          Télécharger
        </button>
      </div>
    </header>
  );
}

function formatSaveLabel(saveState: EditorSaveState, lastSavedAt?: string | null) {
  if (saveState === "saving") return "Enregistrement…";
  if (saveState === "error") return "Erreur d’enregistrement";
  if (saveState === "dirty") return "Modifications non enregistrées";
  if (lastSavedAt) {
    return `Enregistré le ${new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(lastSavedAt))}`;
  }
  return "Enregistré à l’instant";
}
