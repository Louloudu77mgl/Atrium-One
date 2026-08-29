"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { applyTemplate, createElementId, createImageElement, createShapeElement, createTextElement, DEFAULT_FONTS, FORMAT_DIMENSIONS, formatHashtags, normalizeDocument, serializeDocumentToBuilderState, TEMPLATE_LIBRARY } from "@/lib/social-editor/document";
import { getExportFileName, renderDocumentToDataUrl } from "@/lib/social-editor/export";
import type { DesignElement, EditorFormat, EditorSaveState, ExportSettings, HistorySnapshot, InstagramDesignDocument, ShapeVariant } from "@/lib/social-editor/types";
import type { MerchantBrandSettingsRow, MerchantMediaAssetRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";

type UseInstagramEditorArgs = {
  initialDocument: InstagramDesignDocument;
  post: SocialPostRow;
  merchant?: MerchantRow | null;
  brandSettings?: MerchantBrandSettingsRow | null;
  galleryAssets: MerchantMediaAssetRow[];
  onToast: (message: string, tone: "success" | "error" | "saving") => void;
};

export function useInstagramEditor({
  initialDocument,
  post,
  merchant,
  brandSettings,
  galleryAssets,
  onToast
}: UseInstagramEditorArgs) {
  const [documentState, setDocumentState] = useState<InstagramDesignDocument>(normalizeDocument(initialDocument));
  const [selectedElementId, setSelectedElementId] = useState<string | null>(initialDocument.elements[0]?.id ?? null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState(post.last_saved_at ?? post.updated_at ?? null);
  const [activeTab, setActiveTab] = useState<"templates" | "text" | "media" | "elements" | "brand" | "layers">("templates");
  const [zoom, setZoom] = useState(0.64);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [showGuides, setShowGuides] = useState<{ vertical: number | null; horizontal: number | null }>({ vertical: null, horizontal: null });
  const [history, setHistory] = useState<HistorySnapshot[]>([{ document: normalizeDocument(initialDocument), selectedElementId: initialDocument.elements[0]?.id ?? null }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beforeUnloadDirtyRef = useRef(false);
  const historyCommitPending = useRef(false);

  const selectedElement = useMemo(
    () => documentState.elements.find((element) => element.id === selectedElementId) ?? null,
    [documentState.elements, selectedElementId]
  );

  const canvasSize = FORMAT_DIMENSIONS[documentState.format];
  const fitZoom = useMemo(() => {
    if (typeof window === "undefined") {
      return 0.64;
    }
    const availableWidth = Math.max(window.innerWidth - 820, 320);
    const availableHeight = Math.max(window.innerHeight - 260, 320);
    return Math.max(
      0.25,
      Math.min(
        1.4,
        Number(
          Math.min(availableWidth / canvasSize.width, availableHeight / canvasSize.height).toFixed(2)
        )
      )
    );
  }, [canvasSize.height, canvasSize.width]);
  const sortedElements = useMemo(
    () => documentState.elements.slice().sort((left, right) => left.zIndex - right.zIndex),
    [documentState.elements]
  );

  const exportDefaults = useMemo<ExportSettings>(() => ({
    format: "png",
    jpegQuality: 0.92,
    fileName: getExportFileName(documentState.postTitle, "png"),
    transparentBackground: false
  }), [documentState.postTitle]);

  const commitHistory = useCallback((nextDocument: InstagramDesignDocument, nextSelectedId: string | null) => {
    setHistory((current) => {
      const trimmed = current.slice(0, historyIndex + 1);
      const snapshot: HistorySnapshot = {
        document: normalizeDocument(nextDocument),
        selectedElementId: nextSelectedId
      };
      return [...trimmed, snapshot].slice(-80);
    });
    setHistoryIndex((current) => Math.min(current + 1, 79));
  }, [historyIndex]);

  const mutateDocument = useCallback((
    updater: (current: InstagramDesignDocument) => InstagramDesignDocument,
    options?: { commitHistory?: boolean; selectedElementId?: string | null }
  ) => {
    setDocumentState((current) => {
      const next = normalizeDocument(updater(current));
      beforeUnloadDirtyRef.current = true;
      setSaveState("dirty");
      if (options?.selectedElementId !== undefined) {
        setSelectedElementId(options.selectedElementId);
      }
      if (options?.commitHistory !== false) {
        historyCommitPending.current = true;
        window.setTimeout(() => {
          if (historyCommitPending.current) {
            commitHistory(next, options?.selectedElementId ?? selectedElementId);
            historyCommitPending.current = false;
          }
        }, 0);
      }
      return next;
    });
  }, [commitHistory, selectedElementId]);

  const saveNow = useCallback(async (nextDocument?: InstagramDesignDocument) => {
    const payloadDocument = nextDocument ?? documentState;
    const builderState = serializeDocumentToBuilderState(payloadDocument);
    const imageElement = payloadDocument.elements.find((element) => (element.type === "image" || element.type === "logo") && element.visible);
    const hashtags = formatHashtags(payloadDocument.hashtags);

    setSaveState("saving");
    setSaveError(null);

    try {
      const response = await fetchWithTimeout(`/api/social/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payloadDocument.postTitle,
          caption: payloadDocument.caption,
          hashtags: hashtags.split(/\s+/).filter(Boolean),
          visual_text: payloadDocument.altText,
          image_url: imageElement && "src" in imageElement ? imageElement.src : null,
          builder_state: payloadDocument,
          visual_html: "",
          primary_color: payloadDocument.backgroundColor,
          status: "editing"
        })
      });
      const data = (await response.json()) as { post?: SocialPostRow; error?: string };

      if (!response.ok || !data.post) {
        throw new Error(data.error ?? "Impossible d’enregistrer le brouillon.");
      }

      setLastSavedAt(data.post.last_saved_at ?? data.post.updated_at ?? new Date().toISOString());
      setSaveState("saved");
      beforeUnloadDirtyRef.current = false;
    } catch (error) {
      const message = getUserErrorMessage(error, "Erreur d’enregistrement");
      setSaveState("error");
      setSaveError(message);
    }
  }, [documentState, post.id]);

  useEffect(() => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }

    if (saveState !== "dirty") {
      return;
    }

    debouncedSaveRef.current = setTimeout(() => {
      void saveNow();
    }, 1000);

    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [documentState, saveNow, saveState]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!beforeUnloadDirtyRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
      if (isMeta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (isMeta && ((event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y")) {
        event.preventDefault();
        redo();
      }
      if (isMeta && event.key.toLowerCase() === "d" && selectedElement) {
        event.preventDefault();
        duplicateSelected();
      }
      if ((event.key === "Backspace" || event.key === "Delete") && selectedElement && !editingTextId) {
        event.preventDefault();
        removeSelected();
      }
      if (event.key === "Escape") {
        setEditingTextId(null);
        setSelectedElementId(null);
      }
      if (selectedElement && !editingTextId) {
        const step = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveSelectedBy(0, -step, false);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveSelectedBy(0, step, false);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveSelectedBy(-step, 0, false);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveSelectedBy(step, 0, false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingTextId, saveNow, selectedElement]);

  const undo = useCallback(() => {
    setHistoryIndex((current) => {
      const nextIndex = Math.max(0, current - 1);
      const snapshot = history[nextIndex];
      if (snapshot) {
        setDocumentState(snapshot.document);
        setSelectedElementId(snapshot.selectedElementId);
        setSaveState("dirty");
        beforeUnloadDirtyRef.current = true;
      }
      return nextIndex;
    });
  }, [history]);

  const redo = useCallback(() => {
    setHistoryIndex((current) => {
      const nextIndex = Math.min(history.length - 1, current + 1);
      const snapshot = history[nextIndex];
      if (snapshot) {
        setDocumentState(snapshot.document);
        setSelectedElementId(snapshot.selectedElementId);
        setSaveState("dirty");
        beforeUnloadDirtyRef.current = true;
      }
      return nextIndex;
    });
  }, [history]);

  const updateSelectedElement = useCallback((updater: (element: DesignElement) => DesignElement, commit = false) => {
    if (!selectedElementId) {
      return;
    }
    mutateDocument((current) => ({
      ...current,
      elements: current.elements.map((element) => element.id === selectedElementId ? updater(element) : element)
    }), { commitHistory: commit });
  }, [mutateDocument, selectedElementId]);

  const updateElementById = useCallback((elementId: string, updater: (element: DesignElement) => DesignElement, commit = false) => {
    mutateDocument((current) => ({
      ...current,
      elements: current.elements.map((element) => element.id === elementId ? updater(element) : element)
    }), { commitHistory: commit, selectedElementId: elementId });
  }, [mutateDocument]);

  const setGeneralField = useCallback(<K extends keyof InstagramDesignDocument>(key: K, value: InstagramDesignDocument[K]) => {
    mutateDocument((current) => ({ ...current, [key]: value }));
  }, [mutateDocument]);

  const moveSelectedBy = useCallback((deltaX: number, deltaY: number, commit = true) => {
    if (!selectedElement) return;
    const next = moveAndSnap(selectedElement, deltaX, deltaY, canvasSize.width, canvasSize.height);
    setShowGuides({ vertical: next.guideX, horizontal: next.guideY });
    updateSelectedElement(() => next.element, commit);
    if (commit) {
      setTimeout(() => setShowGuides({ vertical: null, horizontal: null }), 180);
    }
  }, [canvasSize.height, canvasSize.width, selectedElement, updateSelectedElement]);

  const moveElementById = useCallback((elementId: string, deltaX: number, deltaY: number, commit = true) => {
    const element = documentState.elements.find((candidate) => candidate.id === elementId);
    if (!element) return;
    const preview = moveAndSnap(element, deltaX, deltaY, canvasSize.width, canvasSize.height);
    setShowGuides({ vertical: preview.guideX, horizontal: preview.guideY });
    updateElementById(
      elementId,
      (current) => moveAndSnap(current, deltaX, deltaY, canvasSize.width, canvasSize.height).element,
      commit
    );
    if (commit) {
      setTimeout(() => setShowGuides({ vertical: null, horizontal: null }), 180);
    }
  }, [canvasSize.height, canvasSize.width, documentState.elements, updateElementById]);

  const resizeSelectedBy = useCallback((handle: "nw" | "ne" | "sw" | "se", deltaX: number, deltaY: number, commit = true) => {
    if (!selectedElement) return;
    updateSelectedElement((element) => resizeElement(element, handle, deltaX, deltaY, canvasSize.width, canvasSize.height), commit);
  }, [canvasSize.height, canvasSize.width, selectedElement, updateSelectedElement]);

  const resizeElementById = useCallback((elementId: string, handle: "nw" | "ne" | "sw" | "se", deltaX: number, deltaY: number, commit = true) => {
    updateElementById(
      elementId,
      (element) => resizeElement(element, handle, deltaX, deltaY, canvasSize.width, canvasSize.height),
      commit
    );
  }, [canvasSize.height, canvasSize.width, updateElementById]);

  const scaleSelected = useCallback((delta: number) => {
    if (!selectedElement) return;
    updateSelectedElement((element) => {
      const nextWidth = clamp(element.width + delta, 60, canvasSize.width);
      const ratio = element.width / Math.max(element.height, 1);
      const nextHeight =
        element.type === "image" || element.type === "logo"
          ? clamp(Math.round(nextWidth / ratio), 40, canvasSize.height)
          : clamp(element.height + delta, 40, canvasSize.height);

      return {
        ...element,
        width: nextWidth,
        height: nextHeight,
        x: clamp(element.x, 0, canvasSize.width - nextWidth),
        y: clamp(element.y, 0, canvasSize.height - nextHeight)
      };
    }, true);
  }, [canvasSize.height, canvasSize.width, selectedElement, updateSelectedElement]);

  const addText = useCallback((kind: Parameters<typeof createTextElement>[0], fontFamily?: string) => {
    const createdElement = createTextElement(kind, canvasSize.width, canvasSize.height);
    const element = fontFamily ? { ...createdElement, fontFamily } : createdElement;
    mutateDocument((current) => ({
      ...current,
      elements: [
        ...current.elements,
        {
          ...element,
          name: `${element.name} ${current.elements.filter((candidate) => candidate.type === "text").length + 1}`,
          x: clamp(element.x + Math.min(current.elements.filter((candidate) => candidate.type === "text").length * 28, 140), 0, canvasSize.width - element.width),
          y: clamp(element.y + Math.min(current.elements.filter((candidate) => candidate.type === "text").length * 28, 140), 0, canvasSize.height - element.height),
          zIndex: current.elements.length + 1
        }
      ]
    }), { selectedElementId: element.id });
    setEditingTextId(element.id);
  }, [canvasSize.height, canvasSize.width, mutateDocument]);

  const addShape = useCallback((shape: ShapeVariant) => {
    const element = createShapeElement(shape, canvasSize.width, canvasSize.height, brandSettings?.accent_color ?? "#A855F7");
    mutateDocument((current) => ({
      ...current,
      elements: [...current.elements, { ...element, zIndex: current.elements.length + 1 }]
    }), { selectedElementId: element.id });
  }, [brandSettings?.accent_color, canvasSize.height, canvasSize.width, mutateDocument]);

  const addImageFromUrl = useCallback((src: string, name = "Image") => {
    const element = createImageElement(src, canvasSize.width, canvasSize.height, name);
    mutateDocument((current) => ({
      ...current,
      elements: [...current.elements, { ...element, zIndex: current.elements.length + 1 }]
    }), { selectedElementId: element.id });
  }, [canvasSize.height, canvasSize.width, mutateDocument]);

  const replaceSelectedImage = useCallback((src: string) => {
    if (selectedElement?.type === "image" || selectedElement?.type === "logo") {
      updateSelectedElement((element) => element.type === "image" || element.type === "logo" ? { ...element, src } : element);
      return;
    }
    addImageFromUrl(src);
  }, [addImageFromUrl, selectedElement, updateSelectedElement]);

  const removeSelected = useCallback(() => {
    if (!selectedElement || selectedElement.locked) return;
    mutateDocument((current) => ({
      ...current,
      elements: current.elements.filter((element) => element.id !== selectedElement.id)
    }), { selectedElementId: null });
  }, [mutateDocument, selectedElement]);

  const duplicateSelected = useCallback(() => {
    if (!selectedElement) return;
    const duplicate = {
      ...structuredClone(selectedElement),
      id: createElementId(selectedElement.type),
      name: `${selectedElement.name} copie`,
      x: selectedElement.x + 24,
      y: selectedElement.y + 24,
      zIndex: documentState.elements.length + 1
    } satisfies DesignElement;
    mutateDocument((current) => ({
      ...current,
      elements: [...current.elements, duplicate]
    }), { selectedElementId: duplicate.id });
  }, [documentState.elements.length, mutateDocument, selectedElement]);

  const reorderSelected = useCallback((direction: "front" | "back" | "forward" | "backward") => {
    if (!selectedElement) return;
    mutateDocument((current) => ({
      ...current,
      elements: reorderElements(current.elements, selectedElement.id, direction)
    }));
  }, [mutateDocument, selectedElement]);

  const toggleSelectedVisibility = useCallback(() => {
    updateSelectedElement((element) => ({ ...element, visible: !element.visible }));
  }, [updateSelectedElement]);

  const toggleSelectedLock = useCallback(() => {
    updateSelectedElement((element) => ({ ...element, locked: !element.locked }));
  }, [updateSelectedElement]);

  const renameSelected = useCallback((name: string) => {
    updateSelectedElement((element) => ({ ...element, name }));
  }, [updateSelectedElement]);

  const setFormat = useCallback((format: EditorFormat) => {
    const nextSize = FORMAT_DIMENSIONS[format];
    mutateDocument((current) => ({
      ...current,
      format,
      elements: current.elements.map((element) => ({
        ...element,
        x: clamp(element.x, 0, nextSize.width - Math.min(element.width, nextSize.width)),
        y: clamp(element.y, 0, nextSize.height - Math.min(element.height, nextSize.height)),
        width: Math.min(element.width, nextSize.width),
        height: Math.min(element.height, nextSize.height)
      }))
    }));
  }, [mutateDocument]);

  const applyTemplateById = useCallback((templateId: string) => {
    if (saveState === "dirty" && !window.confirm("Appliquer un modèle remplacera la composition actuelle. Continuer ?")) {
      return;
    }
    mutateDocument((current) => applyTemplate(current, templateId, merchant, brandSettings), { selectedElementId: null });
  }, [brandSettings, merchant, mutateDocument, saveState]);

  const uploadImage = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.set("image", file);
    setUploading(true);
    onToast("Import de l’image…", "saving");
    try {
      const response = await fetch(`/api/social/posts/${post.id}/upload-image`, {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { imageUrl?: string; error?: string };
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error ?? "Import impossible.");
      }
      replaceSelectedImage(data.imageUrl);
      onToast("Image importée", "success");
    } catch (error) {
      onToast(getUserErrorMessage(error, "Erreur d’import d’image."), "error");
    } finally {
      setUploading(false);
    }
  }, [onToast, post.id, replaceSelectedImage]);

  const generateImage = useCallback(async () => {
    setTransforming(true);
    onToast("Hans génère un visuel…", "saving");
    try {
      const subtitleElement = documentState.elements.find((element) => element.type === "text" && element.name === "Sous-titre");
      const response = await fetch(`/api/social/visuals/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          title: documentState.postTitle,
          postText: documentState.caption,
          visualSubtitle: subtitleElement?.type === "text" ? subtitleElement.text : "",
          style: brandSettings?.visual_style ?? "premium",
          visualPrompt: [
            documentState.postTitle,
            documentState.caption,
            subtitleElement?.type === "text" ? subtitleElement.text : ""
          ].filter(Boolean).join(" · ")
        })
      });
      const data = (await response.json()) as { imageUrl?: string; error?: string };
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error ?? "Génération d’image indisponible.");
      }
      replaceSelectedImage(data.imageUrl);
      onToast("Visuel généré", "success");
    } catch (error) {
      onToast(getUserErrorMessage(error, "Génération d’image indisponible."), "error");
    } finally {
      setTransforming(false);
    }
  }, [brandSettings?.visual_style, documentState.caption, documentState.elements, documentState.postTitle, onToast, post.id, replaceSelectedImage]);

  const exportDesign = useCallback(async (settings: ExportSettings) => {
    setExporting(true);
    try {
      const dataUrl = await renderDocumentToDataUrl(documentState, settings);
      if (settings.format === "png") {
        await fetch(`/api/social/posts/${post.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: dataUrl,
            visualHtml: "",
            sourceImageUrl: null
          })
        });
      }
      const link = window.document.createElement("a");
      link.href = dataUrl;
      link.download = settings.fileName;
      link.click();
      onToast("Téléchargement du visuel lancé", "success");
      setExportOpen(false);
    } catch (error) {
      onToast(getUserErrorMessage(error, "Échec de l’export."), "error");
    } finally {
      setExporting(false);
    }
  }, [documentState, onToast, post.id]);

  return {
    document: documentState,
    selectedElement,
    selectedElementId,
    editingTextId,
    saveState,
    saveError,
    lastSavedAt,
    activeTab,
    zoom,
    previewOpen,
    exportOpen,
    exporting,
    uploading,
    transforming,
    galleryAssets,
    merchant,
    brandSettings,
    historyIndex,
    historyLength: history.length,
    sortedElements,
    canvasSize,
    showGuides,
    exportDefaults,
    templates: TEMPLATE_LIBRARY,
    fonts: DEFAULT_FONTS,
    fitZoom,
    setZoom,
    setPreviewOpen,
    setExportOpen,
    setActiveTab,
    setSelectedElementId,
    setEditingTextId,
    setGeneralField,
    setFormat,
    updateSelectedElement,
    updateElementById,
    moveSelectedBy,
    moveElementById,
    resizeSelectedBy,
    resizeElementById,
    scaleSelected,
    addText,
    addShape,
    addImageFromUrl,
    replaceSelectedImage,
    removeSelected,
    duplicateSelected,
    reorderSelected,
    toggleSelectedVisibility,
    toggleSelectedLock,
    renameSelected,
    applyTemplateById,
    uploadImage,
    generateImage,
    undo,
    redo,
    saveNow: () => saveNow(),
    exportDesign
  };
}

function moveAndSnap(element: DesignElement, deltaX: number, deltaY: number, canvasWidth: number, canvasHeight: number) {
  let x = clamp(element.x + deltaX, 0, canvasWidth - element.width);
  let y = clamp(element.y + deltaY, 0, canvasHeight - element.height);
  let guideX: number | null = null;
  let guideY: number | null = null;
  const centerX = x + element.width / 2;
  const centerY = y + element.height / 2;
  const snap = 10;

  if (Math.abs(centerX - canvasWidth / 2) <= snap) {
    x = Math.round(canvasWidth / 2 - element.width / 2);
    guideX = canvasWidth / 2;
  }
  if (Math.abs(centerY - canvasHeight / 2) <= snap) {
    y = Math.round(canvasHeight / 2 - element.height / 2);
    guideY = canvasHeight / 2;
  }
  if (Math.abs(x) <= snap) {
    x = 0;
  }
  if (Math.abs(y) <= snap) {
    y = 0;
  }
  if (Math.abs(canvasWidth - (x + element.width)) <= snap) {
    x = canvasWidth - element.width;
  }
  if (Math.abs(canvasHeight - (y + element.height)) <= snap) {
    y = canvasHeight - element.height;
  }

  return {
    element: { ...element, x, y },
    guideX,
    guideY
  };
}

function resizeElement(element: DesignElement, handle: "nw" | "ne" | "sw" | "se", deltaX: number, deltaY: number, canvasWidth: number, canvasHeight: number) {
  const keepRatio = element.type === "image" || element.type === "logo";
  const ratio = element.width / Math.max(element.height, 1);
  let next = { ...element };

  if (handle.includes("e")) {
    next.width = clamp(element.width + deltaX, 60, canvasWidth);
  }
  if (handle.includes("s")) {
    next.height = clamp(element.height + deltaY, 40, canvasHeight);
  }
  if (handle.includes("w")) {
    next.x = clamp(element.x + deltaX, 0, element.x + element.width - 60);
    next.width = clamp(element.width - deltaX, 60, canvasWidth);
  }
  if (handle.includes("n")) {
    next.y = clamp(element.y + deltaY, 0, element.y + element.height - 40);
    next.height = clamp(element.height - deltaY, 40, canvasHeight);
  }

  if (keepRatio) {
    next.height = Math.round(next.width / ratio);
  }

  next.x = clamp(next.x, 0, canvasWidth - next.width);
  next.y = clamp(next.y, 0, canvasHeight - next.height);
  return next;
}

function reorderElements(elements: DesignElement[], selectedId: string, direction: "front" | "back" | "forward" | "backward") {
  const sorted = elements.slice().sort((left, right) => left.zIndex - right.zIndex);
  const index = sorted.findIndex((element) => element.id === selectedId);
  if (index === -1) {
    return elements;
  }

  const next = sorted.slice();
  const [item] = next.splice(index, 1);

  if (direction === "front") {
    next.push(item);
  } else if (direction === "back") {
    next.unshift(item);
  } else if (direction === "forward") {
    next.splice(Math.min(index + 1, next.length), 0, item);
  } else {
    next.splice(Math.max(index - 1, 0), 0, item);
  }

  return next.map((element, currentIndex) => ({ ...element, zIndex: currentIndex + 1 }));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
