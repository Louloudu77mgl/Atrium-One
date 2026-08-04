"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AutomationNode } from "./AutomationNode";
import type { AutomationEdge, AutomationFlow, AutomationNodeData, CanvasConnectionDraft } from "./types";

export function AutomationCanvas({
  flow,
  selectedIds,
  connectionDraft,
  zoom,
  pan,
  runNodeIds,
  onSelectNode,
  onMoveNode,
  onDeleteNode,
  onStartConnect,
  onCompleteConnect,
  onRemoveEdge,
  onDropNodeType,
  onPanChange,
  onRecenter,
  onZoomDelta,
  fillViewport = false
}: {
  flow: AutomationFlow | null;
  selectedIds: string[];
  connectionDraft: CanvasConnectionDraft;
  zoom: number;
  pan: { x: number; y: number };
  runNodeIds: string[];
  onSelectNode: (nodeId: string, multi: boolean) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onStartConnect: (nodeId: string, branch: CanvasConnectionDraft extends infer _ ? "default" | "yes" | "no" : never) => void;
  onCompleteConnect: (targetNodeId: string) => void;
  onRemoveEdge: (edgeId: string) => void;
  onDropNodeType: (type: string, world: { x: number; y: number }) => void;
  onPanChange: (next: { x: number; y: number }) => void;
  onRecenter: () => void;
  onZoomDelta: (delta: number) => void;
  fillViewport?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [draggingNode, setDraggingNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (draggingNode && viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        const x = (event.clientX - rect.left - pan.x) / zoom - draggingNode.offsetX;
        const y = (event.clientY - rect.top - pan.y) / zoom - draggingNode.offsetY;
        onMoveNode(draggingNode.id, Math.max(0, x), Math.max(0, y));
      } else if (panning) {
        onPanChange({
          x: panning.panX + (event.clientX - panning.startX),
          y: panning.panY + (event.clientY - panning.startY)
        });
      }
    }

    function handlePointerUp() {
      setDraggingNode(null);
      setPanning(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingNode, onMoveNode, onPanChange, pan.x, pan.y, panning, zoom]);

  const edgePaths = useMemo(() => {
    if (!flow) return [];
    const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
    return flow.edges.map((edge) => buildEdgePath(edge, nodesById.get(edge.source), nodesById.get(edge.target)));
  }, [flow]);
  const minimap = useMemo(() => {
    if (!flow?.nodes.length) return null;
    const xs = flow.nodes.map((node) => node.x);
    const ys = flow.nodes.map((node) => node.y);
    const maxX = Math.max(...flow.nodes.map((node) => node.x + (node.width ?? 300)));
    const maxY = Math.max(...flow.nodes.map((node) => node.y + 200));
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    return { minX, minY, width, height };
  }, [flow]);

  if (!flow) {
    return (
      <div className={`flex items-center justify-center border border-dashed border-[#D8D1E4] bg-[radial-gradient(circle_at_top,#FBF8FF,white_55%)] text-center text-[#6E6A76] ${fillViewport ? "h-full min-h-0 rounded-none border-0" : "h-[720px] rounded-[24px]"}`}>
        Chargez un modèle ou créez une automatisation pour commencer.
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className={`relative overflow-hidden bg-[linear-gradient(to_right,#EDE8F3_1px,transparent_1px),linear-gradient(to_bottom,#EDE8F3_1px,transparent_1px)] bg-[size:40px_40px] ${fillViewport ? "h-full min-h-0 rounded-none border-0" : "h-[78vh] min-h-[820px] rounded-[32px] border border-[#D8D1E4]"}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          setPanning({ startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y });
        }
      }}
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        onZoomDelta(event.deltaY > 0 ? -0.08 : 0.08);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData("application/atrium-node");
        if (!type || !viewportRef.current) return;
        const rect = viewportRef.current.getBoundingClientRect();
        onDropNodeType(type, {
          x: (event.clientX - rect.left - pan.x) / zoom,
          y: (event.clientY - rect.top - pan.y) / zoom
        });
      }}
    >
      <div className="absolute left-5 top-5 z-10 rounded-full bg-white/95 px-4 py-2 text-[12px] font-semibold text-[#6E6A76] shadow">Canvas visuel · molette + zoom · glisser pour naviguer</div>
      <div className="absolute inset-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          {edgePaths.map((edge) => (
            <g key={edge.id}>
              <path d={edge.path} fill="none" stroke={edge.stroke} strokeWidth={5} strokeLinecap="round" onClick={() => onRemoveEdge(edge.id)} className="cursor-pointer" />
              {edge.label && edge.labelX !== null && edge.labelY !== null ? (
                <foreignObject x={edge.labelX - 28} y={edge.labelY - 14} width={56} height={28}>
                  <div className="rounded-full bg-white px-2 py-1 text-center text-[10px] font-bold text-[#17131F] shadow">{edge.label}</div>
                </foreignObject>
              ) : null}
            </g>
          ))}
        </svg>

        {flow.nodes.map((node) => (
          <div
            key={node.id}
            className={runNodeIds.includes(node.id) ? "animate-pulse" : ""}
            onPointerDown={(event) => {
              event.stopPropagation();
              const localX = (event.clientX - (viewportRef.current?.getBoundingClientRect().left ?? 0) - pan.x) / zoom - node.x;
              const localY = (event.clientY - (viewportRef.current?.getBoundingClientRect().top ?? 0) - pan.y) / zoom - node.y;
              setDraggingNode({ id: node.id, offsetX: localX, offsetY: localY });
              onSelectNode(node.id, event.shiftKey);
              if (connectionDraft && connectionDraft.sourceNodeId !== node.id) {
                onCompleteConnect(node.id);
              }
            }}
          >
            <AutomationNode
              node={node}
              selected={selectedIds.includes(node.id)}
              connectionDraft={connectionDraft}
              onSelect={() => undefined}
              onStartConnect={(branch) => onStartConnect(node.id, branch)}
              onDelete={() => onDeleteNode(node.id)}
            />
          </div>
        ))}
      </div>
      {minimap ? (
        <div className="absolute bottom-5 right-5 w-[220px] rounded-[22px] border border-[#EBE6DF] bg-white/95 p-3 shadow-[0_10px_30px_rgba(23,19,31,0.08)]">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Mini-map</div>
            <button type="button" onClick={onRecenter} className="rounded-full bg-[#F6F3EF] px-2.5 py-1 text-[11px] font-semibold text-[#17131F]">Recentrer</button>
          </div>
          <div className="relative h-[120px] overflow-hidden rounded-[16px] bg-[#F9F7F4]">
            {flow.nodes.map((node) => {
              const left = ((node.x - minimap.minX) / minimap.width) * 100;
              const top = ((node.y - minimap.minY) / minimap.height) * 100;
              const width = (((node.width ?? 300) / minimap.width) * 100);
              return <div key={`mini-${node.id}`} className="absolute rounded-md border border-white/70" style={{ left: `${left}%`, top: `${top}%`, width: `${Math.max(8, width)}%`, height: "14px", backgroundColor: node.color }} />;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildEdgePath(edge: AutomationEdge, source?: AutomationNodeData, target?: AutomationNodeData) {
  if (!source || !target) {
    return { id: edge.id, path: "", stroke: "#D7D2E2", label: edge.label, labelX: null, labelY: null };
  }
  const sourceX = source.x + (source.width ?? 300);
  const sourceY = source.y + 112;
  const targetX = target.x;
  const targetY = target.y + 112;
  const curve = Math.max(120, (targetX - sourceX) / 2);
  const path = `M ${sourceX} ${sourceY} C ${sourceX + curve} ${sourceY}, ${targetX - curve} ${targetY}, ${targetX} ${targetY}`;
  const stroke = edge.branch === "yes" ? "#2E9E5B" : edge.branch === "no" ? "#B0ACB7" : "#6E4DE0";
  return { id: edge.id, path, stroke, label: edge.label, labelX: (sourceX + targetX) / 2, labelY: (sourceY + targetY) / 2 - 12 };
}
