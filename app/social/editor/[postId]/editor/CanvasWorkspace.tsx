"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useMemo, useRef } from "react";
import type { DesignElement, TextDesignElement } from "@/lib/social-editor/types";
import styles from "./editor-shell.module.css";
import { getSocialFontStack } from "@/lib/social-fonts";

type ResizeHandle = "nw" | "ne" | "sw" | "se";

export function CanvasWorkspace({
  width,
  height,
  zoom,
  backgroundColor,
  backgroundImage,
  elements,
  selectedElementId,
  editingTextId,
  safetyMargin,
  onSelectElement,
  onMoveElement,
  onResizeElement,
  onChangeText,
  onStartEditingText,
  onStopEditingText,
  onClearSelection,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetZoom,
  onNudgeSelected,
  onScaleSelected,
  guides
}: {
  width: number;
  height: number;
  zoom: number;
  backgroundColor: string;
  backgroundImage: string | null;
  elements: DesignElement[];
  selectedElementId: string | null;
  editingTextId: string | null;
  safetyMargin: boolean;
  onSelectElement: (id: string) => void;
  onMoveElement: (elementId: string, deltaX: number, deltaY: number, commit?: boolean) => void;
  onResizeElement: (elementId: string, handle: ResizeHandle, deltaX: number, deltaY: number, commit?: boolean) => void;
  onChangeText: (elementId: string, text: string) => void;
  onStartEditingText: (id: string) => void;
  onStopEditingText: () => void;
  onClearSelection: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
  onNudgeSelected: (deltaX: number, deltaY: number) => void;
  onScaleSelected: (delta: number) => void;
  guides: { vertical: number | null; horizontal: number | null };
}) {
  const interactionRef = useRef<{
    type: "drag" | "resize";
    elementId: string;
    lastX: number;
    lastY: number;
    handle?: ResizeHandle;
  } | null>(null);

  const stageScale = zoom;
  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementId) ?? null,
    [elements, selectedElementId]
  );

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const deltaX = Math.round((event.clientX - interaction.lastX) / stageScale);
    const deltaY = Math.round((event.clientY - interaction.lastY) / stageScale);
    interaction.lastX = event.clientX;
    interaction.lastY = event.clientY;
    if (interaction.type === "drag") onMoveElement(interaction.elementId, deltaX, deltaY, false);
    else if (interaction.handle) onResizeElement(interaction.elementId, interaction.handle, deltaX, deltaY, false);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const deltaX = Math.round((event.clientX - interaction.lastX) / stageScale);
    const deltaY = Math.round((event.clientY - interaction.lastY) / stageScale);
    if (interaction.type === "drag") onMoveElement(interaction.elementId, deltaX, deltaY, true);
    else if (interaction.handle) onResizeElement(interaction.elementId, interaction.handle, deltaX, deltaY, true);
    interactionRef.current = null;
  }

  return (
    <section className={styles.stage}>
      <div className={styles.stageScroll}>
        <div
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClearSelection();
          }}
          className={styles.canvasWrap}
          style={{ transform: `scale(${zoom})` }}
        >
          {selectedElement && (selectedElement.type === "image" || selectedElement.type === "logo") ? (
            <div className={styles.canvasChrome}>
              <button type="button" className={styles.toolbarChip} onClick={() => onNudgeSelected(-10, 0)}>
                ←
              </button>
              <button type="button" className={styles.toolbarChip} onClick={() => onNudgeSelected(10, 0)}>
                →
              </button>
              <button type="button" className={styles.toolbarChip} onClick={() => onScaleSelected(-40)}>
                Réduire
              </button>
              <button type="button" className={styles.toolbarChip} onClick={() => onScaleSelected(40)}>
                Agrandir
              </button>
            </div>
          ) : null}

          <div className={styles.canvas} style={{ width, height }}>
            <div className="absolute inset-0" style={{ backgroundColor }} />
            {backgroundImage ? <img src={backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            {safetyMargin ? <div className="pointer-events-none absolute inset-10 border border-dashed border-white/75" /> : null}
            {guides.vertical !== null ? <div className="absolute top-0 h-full w-px bg-[#C084FC]/70" style={{ left: guides.vertical }} /> : null}
            {guides.horizontal !== null ? <div className="absolute left-0 h-px w-full bg-[#C084FC]/70" style={{ top: guides.horizontal }} /> : null}
            {elements.map((element) => (
              <ElementView
                key={element.id}
                element={element}
                selected={element.id === selectedElementId}
                editing={element.id === editingTextId}
                onSelect={() => onSelectElement(element.id)}
                onStartDrag={(clientX, clientY) => {
                  interactionRef.current = { type: "drag", elementId: element.id, lastX: clientX, lastY: clientY };
                }}
                onStartResize={(handle, clientX, clientY) => {
                  interactionRef.current = { type: "resize", elementId: element.id, handle, lastX: clientX, lastY: clientY };
                }}
                onStartEditingText={() => onStartEditingText(element.id)}
                onStopEditingText={onStopEditingText}
                onChangeText={(text) => onChangeText(element.id, text)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.bottombar}>
        <div className={styles.pageThumb}>1</div>
        <button type="button" className={styles.addPageBtn}>+</button>
        <div className={styles.bottombarZoom}>
          <button type="button" onClick={onZoomOut}>
            −
          </button>
          <input type="range" min="25" max="200" value={Math.round(zoom * 100)} onChange={() => undefined} readOnly />
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={onZoomIn}>
            +
          </button>
          <button type="button" onClick={onFitToScreen}>
            Adapter
          </button>
          <button type="button" onClick={onResetZoom}>
            100%
          </button>
        </div>
      </div>
    </section>
  );
}

function ElementView({
  element,
  selected,
  editing,
  onSelect,
  onStartDrag,
  onStartResize,
  onStartEditingText,
  onStopEditingText,
  onChangeText
}: {
  element: DesignElement;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onStartDrag: (clientX: number, clientY: number) => void;
  onStartResize: (handle: ResizeHandle, clientX: number, clientY: number) => void;
  onStartEditingText: () => void;
  onStopEditingText: () => void;
  onChangeText: (text: string) => void;
}) {
  if (!element.visible) return null;

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (element.type === "text") onStartEditingText();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || element.locked) return;
        event.stopPropagation();
        onSelect();
        onStartDrag(event.clientX, event.clientY);
      }}
      className={`absolute ${selected ? "outline outline-2 outline-[#5B3FE0]" : ""}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        opacity: element.opacity,
        zIndex: element.zIndex,
        transform: `rotate(${element.rotation}deg)`
      }}
    >
      {element.type === "text" ? (
        <TextElementView element={element} editing={editing} onStopEditingText={onStopEditingText} onChangeText={onChangeText} />
      ) : element.type === "shape" ? (
        <ShapeElementView element={element} />
      ) : (
        <ImageElementView element={element} />
      )}

      {selected && !element.locked
        ? (["nw", "ne", "sw", "se"] as const).map((handle) => (
            <button
              key={handle}
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
                onStartResize(handle, event.clientX, event.clientY);
              }}
              className={`absolute h-[11px] w-[11px] rounded-full border-2 border-[#5B3FE0] bg-white ${
                handle === "nw" ? "-left-[6px] -top-[6px]" : ""
              } ${handle === "ne" ? "-right-[6px] -top-[6px]" : ""} ${
                handle === "sw" ? "-bottom-[6px] -left-[6px]" : ""
              } ${handle === "se" ? "-bottom-[6px] -right-[6px]" : ""}`}
            />
          ))
        : null}
    </div>
  );
}

function TextElementView({
  element,
  editing,
  onStopEditingText,
  onChangeText
}: {
  element: TextDesignElement;
  editing: boolean;
  onStopEditingText: () => void;
  onChangeText: (text: string) => void;
}) {
  if (editing) {
    return (
      <textarea
        autoFocus
        defaultValue={element.text}
        onBlur={(event) => {
          onChangeText(event.currentTarget.value);
          onStopEditingText();
        }}
        className="h-full w-full resize-none border-0 bg-white/90 p-2 outline-none"
        style={{
          fontFamily: getSocialFontStack(element.fontFamily),
          fontSize: element.fontSize,
          fontWeight: element.fontWeight,
          color: element.color,
          textAlign: element.align
        }}
      />
    );
  }

  return (
    <div
      className="h-full w-full whitespace-pre-wrap"
      style={{
        fontFamily: getSocialFontStack(element.fontFamily),
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle,
        textDecoration: element.underline ? "underline" : "none",
        color: element.color,
        backgroundColor: element.backgroundColor ?? "transparent",
        lineHeight: element.lineHeight,
        letterSpacing: `${element.letterSpacing}px`,
        textAlign: element.align,
        padding: "12px",
        boxSizing: "border-box"
      }}
    >
      {element.text}
    </div>
  );
}

function ImageElementView({ element }: { element: Extract<DesignElement, { type: "image" | "logo" }> }) {
  return (
    <div className="h-full w-full overflow-hidden" style={{ borderRadius: element.borderRadius }}>
      {element.src ? (
        <img
          src={element.src}
          alt={element.name}
          className="h-full w-full"
          style={{
            objectFit: element.fit,
            objectPosition: `${element.cropX}% ${element.cropY}%`,
            transform: `scale(${element.scale})`,
            transformOrigin: "center center"
          }}
        />
      ) : null}
    </div>
  );
}

function ShapeElementView({ element }: { element: Extract<DesignElement, { type: "shape" }> }) {
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: element.fill,
        borderColor: element.borderColor,
        borderWidth: element.borderWidth,
        borderStyle: "solid",
        borderRadius: element.shape === "circle" || element.shape === "pill" ? 999 : element.borderRadius
      }}
    />
  );
}
