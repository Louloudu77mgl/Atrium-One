"use client";

import type { ReactNode } from "react";
import { buttonStyles } from "@/lib/design-system";
import type {
  DesignElement,
  EditorFormat,
  InstagramDesignDocument,
  ShapeDesignElement,
  TextDesignElement
} from "@/lib/social-editor/types";

export function PropertiesPanel({
  document,
  selectedElement,
  onUpdateGeneral,
  onSetFormat,
  onUpdateSelected,
  onDuplicate,
  onDelete,
  onReorder
}: {
  document: InstagramDesignDocument;
  selectedElement: DesignElement | null;
  onUpdateGeneral: <K extends keyof InstagramDesignDocument>(key: K, value: InstagramDesignDocument[K]) => void;
  onSetFormat: (format: EditorFormat) => void;
  onUpdateSelected: (updater: (element: DesignElement) => DesignElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (direction: "front" | "back" | "forward" | "backward") => void;
}) {
  return (
    <aside className="rounded-[16px] border border-[#E9D5FF] bg-white shadow-[0_12px_38px_rgba(76,29,149,0.06)]">
      <div className="border-b border-[#F1E7FF] px-4 py-3">
        <h2 className="text-base font-black text-[#211432]">
          {selectedElement ? selectedElement.name : "Réglages du post"}
        </h2>
        <p className="mt-1 text-xs text-[#8B7AA8]">
          {selectedElement ? "Modifiez l’élément sélectionné." : "Paramètres globaux du post Instagram."}
        </p>
      </div>
      <div className="max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto p-4">
        {!selectedElement ? (
          <GeneralPostProperties
            document={document}
            onUpdateGeneral={onUpdateGeneral}
            onSetFormat={onSetFormat}
          />
        ) : selectedElement.type === "text" ? (
          <TextProperties
            element={selectedElement}
            onUpdate={(updater) => onUpdateSelected((element) => (element.type === "text" ? updater(element) : element))}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onReorder={onReorder}
          />
        ) : selectedElement.type === "shape" ? (
          <ShapeProperties
            element={selectedElement}
            onUpdate={(updater) => onUpdateSelected((element) => (element.type === "shape" ? updater(element) : element))}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onReorder={onReorder}
          />
        ) : (
          <ImageProperties
            element={selectedElement}
            onUpdate={(updater) =>
              onUpdateSelected((element) =>
                element.type === "image" || element.type === "logo" ? updater(element) : element
              )
            }
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onReorder={onReorder}
          />
        )}
      </div>
    </aside>
  );
}

function GeneralPostProperties({
  document,
  onUpdateGeneral,
  onSetFormat
}: {
  document: InstagramDesignDocument;
  onUpdateGeneral: <K extends keyof InstagramDesignDocument>(key: K, value: InstagramDesignDocument[K]) => void;
  onSetFormat: (format: EditorFormat) => void;
}) {
  return (
    <div className="space-y-4">
      <PanelSection title="Essentiel" defaultOpen>
        <Field label="Format">
          <select
            value={document.format}
            onChange={(event) => onSetFormat(event.target.value as EditorFormat)}
            className={inputClass}
          >
            <option value="square">Carré</option>
            <option value="portrait">Portrait</option>
            <option value="story">Story</option>
          </select>
        </Field>
        <Field label="Couleur d’arrière-plan">
          <input
            type="color"
            value={document.backgroundColor}
            onChange={(event) => onUpdateGeneral("backgroundColor", event.target.value)}
            className={colorClass}
          />
        </Field>
        <Field label="Image d’arrière-plan">
          <input
            value={document.backgroundImage ?? ""}
            onChange={(event) =>
              onUpdateGeneral("backgroundImage", event.target.value.trim() ? event.target.value : null)
            }
            className={inputClass}
            placeholder="URL d’image optionnelle"
          />
        </Field>
        <Field label="Légende Instagram">
          <textarea
            value={document.caption}
            onChange={(event) => onUpdateGeneral("caption", event.target.value)}
            rows={5}
            className={inputClass}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-[#8B7AA8]">
            <span>{document.caption.length} caractères</span>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(document.caption)}
              className="font-bold text-[#6D28D9] transition hover:text-[#4C1D95]"
            >
              Copier la légende
            </button>
          </div>
        </Field>
        <Field label="Hashtags">
          <textarea
            value={document.hashtags}
            onChange={(event) => onUpdateGeneral("hashtags", event.target.value)}
            rows={3}
            className={inputClass}
          />
        </Field>
        <Field label="Texte alternatif">
          <input
            value={document.altText}
            onChange={(event) => onUpdateGeneral("altText", event.target.value)}
            className={inputClass}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Avancé">
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#E9D5FF] bg-[#FBFAFF] px-4 py-3">
          <span className="text-sm font-semibold text-[#211432]">Afficher les marges de sécurité</span>
          <input
            type="checkbox"
            checked={document.safetyMargin}
            onChange={(event) => onUpdateGeneral("safetyMargin", event.target.checked)}
            className="h-5 w-5 accent-[#4C1D95]"
          />
        </label>
      </PanelSection>
    </div>
  );
}

function TextProperties({
  element,
  onUpdate,
  onDuplicate,
  onDelete,
  onReorder
}: {
  element: TextDesignElement;
  onUpdate: (updater: (element: TextDesignElement) => TextDesignElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (direction: "front" | "back" | "forward" | "backward") => void;
}) {
  return (
    <div className="space-y-4">
      <PanelSection title="Essentiel" defaultOpen>
        <Field label="Contenu">
          <textarea
            value={element.text}
            onChange={(event) => onUpdate((current) => ({ ...current, text: event.target.value }))}
            rows={5}
            className={inputClass}
          />
        </Field>
        <Field label="Police">
          <select
            value={element.fontFamily}
            onChange={(event) => onUpdate((current) => ({ ...current, fontFamily: event.target.value }))}
            className={inputClass}
          >
            <option value="Inter">Inter</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
            <option value="Helvetica Neue">Helvetica Neue</option>
          </select>
        </Field>
        <Field label="Taille">
          <input
            type="range"
            min="16"
            max="140"
            value={element.fontSize}
            onChange={(event) => onUpdate((current) => ({ ...current, fontSize: Number(event.target.value) }))}
          />
        </Field>
        <Field label="Couleur">
          <input
            type="color"
            value={element.color}
            onChange={(event) => onUpdate((current) => ({ ...current, color: event.target.value }))}
            className={colorClass}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Style">
        <Field label="Alignement">
          <select
            value={element.align}
            onChange={(event) =>
              onUpdate((current) => ({ ...current, align: event.target.value as TextDesignElement["align"] }))
            }
            className={inputClass}
          >
            <option value="left">Gauche</option>
            <option value="center">Centre</option>
            <option value="right">Droite</option>
          </select>
        </Field>
        <Field label="Fond facultatif">
          <input
            type="color"
            value={element.backgroundColor ?? "#ffffff"}
            onChange={(event) => onUpdate((current) => ({ ...current, backgroundColor: event.target.value }))}
            className={colorClass}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Position">
        <PositionFields element={element} onUpdate={onUpdate} />
      </PanelSection>

      <ActionSection onDuplicate={onDuplicate} onDelete={onDelete} onReorder={onReorder} />
    </div>
  );
}

function ImageProperties({
  element,
  onUpdate,
  onDuplicate,
  onDelete,
  onReorder
}: {
  element: Extract<DesignElement, { type: "image" | "logo" }>;
  onUpdate: (
    updater: (
      element: Extract<DesignElement, { type: "image" | "logo" }>
    ) => Extract<DesignElement, { type: "image" | "logo" }>
  ) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (direction: "front" | "back" | "forward" | "backward") => void;
}) {
  return (
    <div className="space-y-4">
      <PanelSection title="Essentiel" defaultOpen>
        <Field label="Source image">
          <input
            value={element.src}
            onChange={(event) => onUpdate((current) => ({ ...current, src: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Mode image">
          <select
            value={element.fit}
            onChange={(event) => onUpdate((current) => ({ ...current, fit: event.target.value as typeof current.fit }))}
            className={inputClass}
          >
            <option value="cover">Remplir</option>
            <option value="contain">Ajuster</option>
          </select>
        </Field>
        <Field label="Position X">
          <input
            type="range"
            min="0"
            max="100"
            value={element.cropX}
            onChange={(event) => onUpdate((current) => ({ ...current, cropX: Number(event.target.value) }))}
          />
        </Field>
        <Field label="Position Y">
          <input
            type="range"
            min="0"
            max="100"
            value={element.cropY}
            onChange={(event) => onUpdate((current) => ({ ...current, cropY: Number(event.target.value) }))}
          />
        </Field>
        <Field label="Zoom">
          <input
            type="range"
            min="0.6"
            max="2.4"
            step="0.05"
            value={element.scale}
            onChange={(event) => onUpdate((current) => ({ ...current, scale: Number(event.target.value) }))}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Style">
        <Field label="Opacité">
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={element.opacity}
            onChange={(event) => onUpdate((current) => ({ ...current, opacity: Number(event.target.value) }))}
          />
        </Field>
        <Field label="Rayon des coins">
          <input
            type="range"
            min="0"
            max="60"
            value={element.borderRadius}
            onChange={(event) => onUpdate((current) => ({ ...current, borderRadius: Number(event.target.value) }))}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Position">
        <PositionFields element={element} onUpdate={onUpdate} />
      </PanelSection>

      <ActionSection onDuplicate={onDuplicate} onDelete={onDelete} onReorder={onReorder} />
    </div>
  );
}

function ShapeProperties({
  element,
  onUpdate,
  onDuplicate,
  onDelete,
  onReorder
}: {
  element: ShapeDesignElement;
  onUpdate: (updater: (element: ShapeDesignElement) => ShapeDesignElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (direction: "front" | "back" | "forward" | "backward") => void;
}) {
  return (
    <div className="space-y-4">
      <PanelSection title="Essentiel" defaultOpen>
        <Field label="Couleur de remplissage">
          <input
            type="color"
            value={element.fill === "transparent" ? "#ffffff" : element.fill}
            onChange={(event) => onUpdate((current) => ({ ...current, fill: event.target.value }))}
            className={colorClass}
          />
        </Field>
        <Field label="Couleur de bordure">
          <input
            type="color"
            value={element.borderColor}
            onChange={(event) => onUpdate((current) => ({ ...current, borderColor: event.target.value }))}
            className={colorClass}
          />
        </Field>
        <Field label="Épaisseur de bordure">
          <input
            type="range"
            min="0"
            max="16"
            value={element.borderWidth}
            onChange={(event) => onUpdate((current) => ({ ...current, borderWidth: Number(event.target.value) }))}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Style">
        <Field label="Opacité">
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={element.opacity}
            onChange={(event) => onUpdate((current) => ({ ...current, opacity: Number(event.target.value) }))}
          />
        </Field>
        <Field label="Rayon">
          <input
            type="range"
            min="0"
            max="80"
            value={element.borderRadius}
            onChange={(event) => onUpdate((current) => ({ ...current, borderRadius: Number(event.target.value) }))}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Position">
        <PositionFields element={element} onUpdate={onUpdate} />
      </PanelSection>

      <ActionSection onDuplicate={onDuplicate} onDelete={onDelete} onReorder={onReorder} />
    </div>
  );
}

function ActionSection({
  onDuplicate,
  onDelete,
  onReorder
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (direction: "front" | "back" | "forward" | "backward") => void;
}) {
  return (
    <PanelSection title="Avancé">
      <FieldRow>
        <button type="button" onClick={() => onReorder("front")} className={buttonStyles.secondary}>
          Premier plan
        </button>
        <button type="button" onClick={() => onReorder("back")} className={buttonStyles.secondary}>
          Arrière-plan
        </button>
      </FieldRow>
      <FieldRow>
        <button type="button" onClick={onDuplicate} className={buttonStyles.tertiary}>
          Dupliquer
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center rounded-xl bg-[#FEF2F2] px-4 py-2.5 text-sm font-bold text-[#DC2626] transition hover:bg-[#FEE2E2]"
        >
          Supprimer
        </button>
      </FieldRow>
    </PanelSection>
  );
}

function PositionFields<T extends DesignElement>({
  element,
  onUpdate
}: {
  element: T;
  onUpdate: (updater: (element: T) => T) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="X">
        <input
          type="number"
          value={Math.round(element.x)}
          onChange={(event) => onUpdate((current) => ({ ...current, x: Number(event.target.value) }))}
          className={inputClass}
        />
      </Field>
      <Field label="Y">
        <input
          type="number"
          value={Math.round(element.y)}
          onChange={(event) => onUpdate((current) => ({ ...current, y: Number(event.target.value) }))}
          className={inputClass}
        />
      </Field>
      <Field label="Largeur">
        <input
          type="number"
          value={Math.round(element.width)}
          onChange={(event) => onUpdate((current) => ({ ...current, width: Number(event.target.value) }))}
          className={inputClass}
        />
      </Field>
      <Field label="Hauteur">
        <input
          type="number"
          value={Math.round(element.height)}
          onChange={(event) => onUpdate((current) => ({ ...current, height: Number(event.target.value) }))}
          className={inputClass}
        />
      </Field>
      <Field label="Rotation">
        <input
          type="range"
          min="-45"
          max="45"
          value={element.rotation}
          onChange={(event) => onUpdate((current) => ({ ...current, rotation: Number(event.target.value) }))}
        />
      </Field>
    </div>
  );
}

function PanelSection({
  title,
  children,
  defaultOpen = false
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-2xl border border-[#E9D5FF] bg-[#FBFAFF] p-3">
      <summary className="cursor-pointer list-none text-sm font-black text-[#211432]">{title}</summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#211432]">
      {label}
      {children}
    </label>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

const inputClass =
  "w-full rounded-xl border border-[#E9D5FF] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#7C3AED]";
const colorClass = "h-12 w-full rounded-lg border border-[#E9D5FF] bg-white p-1";
