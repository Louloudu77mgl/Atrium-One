"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { buttonStyles } from "@/lib/design-system";
import { TEMPLATE_LIBRARY } from "@/lib/social-editor/document";
import { SOCIAL_FONTS } from "@/lib/social-fonts";
import type { EditorSidebarTab } from "@/lib/social-editor/types";
import type { MerchantBrandSettingsRow, MerchantMediaAssetRow } from "@/lib/supabase/types";
import styles from "./editor-shell.module.css";

const tabMeta = [
  { id: "templates", label: "Design", icon: "sparkle" },
  { id: "elements", label: "Éléments", icon: "star" },
  { id: "text", label: "Texte", icon: "message" },
  { id: "brand", label: "Marque", icon: "gear" },
  { id: "media", label: "Imports", icon: "image" },
  { id: "layers", label: "Calques", icon: "document" }
] as const;

export function EditorSidebar({
  activeTab,
  onTabChange,
  onApplyTemplate,
  onAddText,
  onAddShape,
  onUploadImage,
  onSelectGalleryImage,
  onGenerateImage,
  galleryAssets,
  brandSettings,
  layerPanel
}: {
  activeTab: EditorSidebarTab;
  onTabChange: (tab: EditorSidebarTab) => void;
  onApplyTemplate: (templateId: string) => void;
  onAddText: (kind: "title" | "subtitle" | "body" | "small", fontFamily?: string) => void;
  onAddShape: (shape: "rectangle" | "circle" | "line" | "band" | "frame" | "pill" | "divider") => void;
  onUploadImage: (file: File) => void;
  onSelectGalleryImage: (url: string, name: string) => void;
  onGenerateImage: () => void;
  galleryAssets: MerchantMediaAssetRow[];
  brandSettings?: MerchantBrandSettingsRow | null;
  layerPanel: ReactNode;
}) {
  return (
    <>
      <nav className={styles.sidenav}>
        {tabMeta.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.navItem} ${selected ? styles.navItemActive : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon name={tab.icon} className="h-5 w-5" />
              <span className={styles.navItemLabel}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <aside className={styles.sidepanel}>
        <div className={styles.spHead}>
          <div className={styles.spTitle}>
            {activeTab === "templates"
              ? "Design"
              : activeTab === "elements"
                ? "Éléments"
                : activeTab === "text"
                  ? "Texte"
                  : activeTab === "brand"
                    ? "Marque"
                    : activeTab === "media"
                      ? "Imports"
                      : "Calques"}
          </div>
        </div>
        <div className={styles.spBody}>
          {activeTab === "templates" ? <TemplatesPanel onApplyTemplate={onApplyTemplate} /> : null}
          {activeTab === "elements" ? <ElementsPanel onAddShape={onAddShape} /> : null}
          {activeTab === "text" ? <TextPanel onAddText={onAddText} /> : null}
          {activeTab === "brand" ? <BrandPanel brandSettings={brandSettings} /> : null}
          {activeTab === "media" ? (
            <MediaPanel
              onUploadImage={onUploadImage}
              onSelectGalleryImage={onSelectGalleryImage}
              onGenerateImage={onGenerateImage}
              galleryAssets={galleryAssets}
            />
          ) : null}
          {activeTab === "layers" ? layerPanel : null}
        </div>
      </aside>
    </>
  );
}

function TemplatesPanel({ onApplyTemplate }: { onApplyTemplate: (templateId: string) => void }) {
  return (
    <div>
      <div className={styles.spSectionTitle}>Modèles</div>
      <div className="grid gap-[10px]">
        {TEMPLATE_LIBRARY.map((template) => (
          <button key={template.id} type="button" onClick={() => onApplyTemplate(template.id)} className={styles.tplTile}>
            <div className={styles.tplTilePreview + " bg-gradient-to-br from-[#1C1140] via-[#5B3FE0] to-[#EFE9FE]"} />
            <div className="p-[10px]">
              <div className="text-[12px] font-bold text-[#181227]">{template.title}</div>
              <div className="mt-1 text-[11px] text-[#8B87A0]">{template.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TextPanel({ onAddText }: { onAddText: (kind: "title" | "subtitle" | "body" | "small", fontFamily?: string) => void }) {
  const items = [
    { kind: "title" as const, label: "Ajouter un titre", desc: "Grand texte pour l’accroche." },
    { kind: "subtitle" as const, label: "Ajouter un sous-titre", desc: "Texte intermédiaire." },
    { kind: "body" as const, label: "Ajouter un texte", desc: "Bloc de texte simple." },
    { kind: "small" as const, label: "Ajouter un petit texte", desc: "Texte secondaire discret." }
  ];

  return (
    <div>
      <div className={styles.spSectionTitle}>Styles de texte</div>
      <div className="grid gap-[9px]">
        {items.map((item) => (
          <button key={item.kind} type="button" onClick={() => onAddText(item.kind)} className={styles.cardButton}>
            <div className="text-[13px] font-bold text-[#181227]">{item.label}</div>
            <div className="mt-1 text-[11px] text-[#8B87A0]">{item.desc}</div>
          </button>
        ))}
      </div>
      <div className={styles.spSectionTitle}>Toutes les typographies</div>
      <div className="grid gap-2">
        {SOCIAL_FONTS.map((font) => (
          <button
            key={font.value}
            type="button"
            onClick={() => onAddText("title", font.value)}
            className={styles.cardButton}
          >
            <div className="text-[11px] font-semibold text-[#8B87A0]">{font.label}</div>
            <div className="mt-1 truncate text-[20px] leading-6 text-[#181227]" style={{ fontFamily: font.stack }}>
              Belle histoire
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ElementsPanel({
  onAddShape
}: {
  onAddShape: (shape: "rectangle" | "circle" | "line" | "band" | "frame" | "pill" | "divider") => void;
}) {
  const shapes = [
    { id: "rectangle", label: "Rectangle" },
    { id: "circle", label: "Cercle" },
    { id: "line", label: "Ligne" },
    { id: "band", label: "Bandeau" },
    { id: "frame", label: "Encadré" },
    { id: "pill", label: "Pastille" }
  ] as const;

  return (
    <div>
      <div className={styles.spSectionTitle}>Éléments</div>
      <div className={styles.tileGrid2}>
        {shapes.map((shape) => (
          <button key={shape.id} type="button" onClick={() => onAddShape(shape.id)} className={styles.shapeTile}>
            <span className="text-[12px] font-bold text-[#181227]">{shape.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BrandPanel({ brandSettings }: { brandSettings?: MerchantBrandSettingsRow | null }) {
  if (!brandSettings) {
    return <div className="text-[13px] text-[#8B87A0]">Ajoutez votre logo et vos couleurs dans les réglages pour les retrouver ici.</div>;
  }

  const colors = [brandSettings.primary_color, brandSettings.secondary_color, brandSettings.accent_color];

  return (
    <div>
      <div className={styles.spSectionTitle}>Couleurs de marque</div>
      <div className={styles.tileGrid2}>
        {colors.map((color) => (
          <div key={color} className={styles.shapeTile}>
            <div className="h-10 w-10 rounded-[10px]" style={{ backgroundColor: color }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaPanel({
  onUploadImage,
  onSelectGalleryImage,
  onGenerateImage,
  galleryAssets
}: {
  onUploadImage: (file: File) => void;
  onSelectGalleryImage: (url: string, name: string) => void;
  onGenerateImage: () => void;
  galleryAssets: MerchantMediaAssetRow[];
}) {
  return (
    <div>
      <div className={styles.spSectionTitle}>Importer</div>
      <label className={styles.uploadDrop}>
        <Icon name="image" className={styles.uploadDropIcon + " h-6 w-6"} />
        <div className="font-semibold">Glissez une image ici</div>
        <div className="mt-1">ou choisissez un fichier</div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onUploadImage(file);
          }}
        />
      </label>
      <button type="button" onClick={onGenerateImage} className={`${buttonStyles.primary} w-full`}>
        Générer une composition avec Hans
      </button>

      <div className={styles.spSectionTitle}>Photos</div>
      <div className={styles.tileGrid2}>
        {galleryAssets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => onSelectGalleryImage(asset.url, asset.alt_text ?? "Image du commerce")}
            className={styles.photoTile}
          >
            <img src={asset.url} alt={asset.alt_text ?? "Image du commerce"} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
