"use client";

import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { createEditorDocument } from "@/lib/social-editor/document";
import type {
  MerchantBrandSettingsRow,
  MerchantMediaAssetRow,
  MerchantRow,
  SocialPostRow
} from "@/lib/supabase/types";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { EditorSidebar } from "./EditorSidebar";
import { EditorTopBar } from "./EditorTopBar";
import { ExportDialog } from "./ExportDialog";
import { InstagramPreviewDialog } from "./InstagramPreviewDialog";
import styles from "./editor-shell.module.css";
import { useInstagramEditor } from "./useInstagramEditor";

export function InstagramEditorPage({
  post,
  merchant,
  brandSettings,
  galleryAssets
}: {
  post: SocialPostRow;
  merchant?: MerchantRow | null;
  brandSettings?: MerchantBrandSettingsRow | null;
  galleryAssets: MerchantMediaAssetRow[];
}) {
  const { toast, showToast } = useToast(3200);
  const editor = useInstagramEditor({
    initialDocument: createEditorDocument({ post, merchant, brandSettings, galleryAssets }),
    post,
    merchant,
    brandSettings,
    galleryAssets,
    onToast: showToast
  });

  return (
    <div className={styles.app}>
      <EditorTopBar
        title={editor.document.postTitle}
        zoom={editor.zoom}
        onTitleChange={(value) => editor.setGeneralField("postTitle", value)}
        saveState={editor.saveState}
        saveError={editor.saveError}
        canUndo={editor.historyIndex > 0}
        canRedo={editor.historyIndex < editor.historyLength - 1}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onPreview={() => editor.setPreviewOpen(true)}
        onExport={() => editor.setExportOpen(true)}
        onSave={editor.saveNow}
        onZoomIn={() => editor.setZoom((current) => Math.min(2, Number((current + 0.1).toFixed(2))))}
        onZoomOut={() => editor.setZoom((current) => Math.max(0.25, Number((current - 0.1).toFixed(2))))}
        lastSavedAt={editor.lastSavedAt}
      />

      <main className={styles.bodyGrid}>
        <EditorSidebar
          activeTab={editor.activeTab}
          onTabChange={editor.setActiveTab}
          onApplyTemplate={editor.applyTemplateById}
          onAddText={editor.addText}
          onAddShape={editor.addShape}
          onUploadImage={editor.uploadImage}
          onSelectGalleryImage={(url) => editor.replaceSelectedImage(url)}
          onGenerateImage={editor.generateImage}
          galleryAssets={editor.galleryAssets}
          brandSettings={editor.brandSettings}
          layerPanel={
            <div>
              <div className={styles.spSectionTitle}>Calques</div>
              {editor.sortedElements
                .slice()
                .reverse()
                .map((element) => (
                  <button
                    key={element.id}
                    type="button"
                    onClick={() => editor.setSelectedElementId(element.id)}
                    className={`${styles.layerRow} ${editor.selectedElementId === element.id ? styles.layerRowSelected : ""}`}
                  >
                    <div className={styles.layerThumb} />
                    <div className={styles.layerName}>{element.name}</div>
                  </button>
                ))}
            </div>
          }
        />

        <CanvasWorkspace
          width={editor.canvasSize.width}
          height={editor.canvasSize.height}
          zoom={editor.zoom}
          backgroundColor={editor.document.backgroundColor}
          backgroundImage={editor.document.backgroundImage}
          elements={editor.sortedElements}
          selectedElementId={editor.selectedElementId}
          editingTextId={editor.editingTextId}
          safetyMargin={editor.document.safetyMargin}
          onSelectElement={editor.setSelectedElementId}
          onMoveElement={editor.moveElementById}
          onResizeElement={editor.resizeElementById}
          onChangeText={(elementId, text) =>
            editor.updateElementById(elementId, (element) => (element.type === "text" ? { ...element, text } : element))
          }
          onStartEditingText={editor.setEditingTextId}
          onStopEditingText={() => editor.setEditingTextId(null)}
          onClearSelection={() => editor.setSelectedElementId(null)}
          onZoomIn={() => editor.setZoom((current) => Math.min(2, Number((current + 0.1).toFixed(2))))}
          onZoomOut={() => editor.setZoom((current) => Math.max(0.25, Number((current - 0.1).toFixed(2))))}
          onFitToScreen={() => editor.setZoom(editor.fitZoom)}
          onResetZoom={() => editor.setZoom(1)}
          onNudgeSelected={(deltaX, deltaY) => editor.moveSelectedBy(deltaX, deltaY, true)}
          onScaleSelected={(delta) => editor.scaleSelected(delta)}
          guides={editor.showGuides}
        />
      </main>

      <InstagramPreviewDialog
        open={editor.previewOpen}
        onClose={() => editor.setPreviewOpen(false)}
        onExport={() => {
          editor.setPreviewOpen(false);
          editor.setExportOpen(true);
        }}
        document={editor.document}
        businessName={merchant?.business_name ?? "Votre commerce"}
        logoUrl={merchant?.logo_url ?? null}
      />

      <ExportDialog
        open={editor.exportOpen}
        onClose={() => editor.setExportOpen(false)}
        onExport={editor.exportDesign}
        format={editor.document.format}
        title={editor.document.postTitle}
        exporting={editor.exporting}
      />

      <Toast toast={toast} />
    </div>
  );
}
