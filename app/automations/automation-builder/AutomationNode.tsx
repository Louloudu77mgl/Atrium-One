"use client";

import { Icon } from "@/components/icons";
import type { AutomationNodeData, EdgeBranch } from "./types";

const branchAccent: Record<EdgeBranch, string> = {
  default: "#6E4DE0",
  yes: "#2E9E5B",
  no: "#A0A0AA"
};

export function AutomationNode({
  node,
  selected,
  connectionDraft,
  onSelect,
  onStartConnect,
  onDelete
}: {
  node: AutomationNodeData;
  selected: boolean;
  connectionDraft: { sourceNodeId: string; branch: EdgeBranch } | null;
  onSelect: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStartConnect: (branch: EdgeBranch) => void;
  onDelete: () => void;
}) {
  const branches = node.category === "condition" ? (["yes", "no"] as EdgeBranch[]) : (["default"] as EdgeBranch[]);

  return (
    <div
      className={`absolute w-[300px] rounded-[28px] border bg-white shadow-[0_14px_40px_rgba(23,19,31,0.08)] transition-shadow ${selected ? "border-[#6E4DE0] ring-2 ring-[#E6DEFF] shadow-[0_20px_50px_rgba(110,77,224,0.14)]" : "border-[#EBE6DF]"}`}
      style={{ left: node.x, top: node.y }}
      onPointerDown={onSelect}
    >
      <div className="flex items-start gap-4 rounded-t-[28px] px-5 py-5" style={{ backgroundColor: `${node.color}12` }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] text-white" style={{ backgroundColor: node.color }}>
          <Icon name={node.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8D8797]">
            {node.category === "trigger" ? "Quand cela arrive" : node.category === "condition" ? "Vérifier si" : node.category === "delay" ? "Attendre" : node.category === "control" ? "Contrôle" : "Hans doit faire"}
          </div>
          <div className="mt-1 text-[18px] font-extrabold tracking-[-0.02em] text-[#17131F]">{node.title}</div>
          <p className="mt-1.5 text-[13.5px] leading-6 text-[#6E6A76]">{node.description}</p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="space-y-1 text-[12.5px] text-[#6E6A76]">
          {node.type === "google_review" ? (
            <div>
              <span className="font-semibold text-[#17131F]">Rythme :</span> {node.config.interval_count && node.config.interval_unit
                ? `Tous les ${Math.max(1, Number(node.config.interval_count))} ${String(node.config.interval_unit)}`
                : "À configurer"}
            </div>
          ) : Object.entries(node.config).slice(0, 2).map(([key, value]) => (
            <div key={key}>
              <span className="font-semibold text-[#17131F]">{humanizeKey(key)} :</span> {String(value)}
            </div>
          ))}
          {node.type !== "google_review" && !Object.keys(node.config).length ? <span>Aucune configuration pour le moment.</span> : null}
        </div>
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-full bg-[#F6F3EF] px-3 py-1.5 text-[11px] font-semibold text-[#6E6A76]">
            {node.mode === "automatic" ? "Automatique" : node.mode === "semi_automatic" ? "Semi-auto" : node.mode === "draft_only" ? "Suggestion" : "À configurer"}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-full border border-[#F1D5D0] px-2 py-1 text-[11px] font-semibold text-[#C2492F]"
          >
            Supprimer
          </button>
        </div>
      </div>

      <div className="absolute -left-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#17131F]" />
      <div className="absolute -right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        {branches.map((branch) => (
          <button
            key={branch}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onStartConnect(branch);
            }}
            className={`flex items-center gap-2 rounded-full border border-white px-3 py-1.5 text-[11px] font-bold text-white shadow ${connectionDraft?.sourceNodeId === node.id && connectionDraft.branch === branch ? "ring-2 ring-white/70" : ""}`}
            style={{ backgroundColor: branchAccent[branch] }}
          >
            {branch === "yes" ? "Oui" : branch === "no" ? "Non" : "Relier"}
          </button>
        ))}
      </div>
    </div>
  );
}

function humanizeKey(key: string) {
  return key.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}
