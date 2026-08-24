"use client";

import { useState } from "react";
import Link from "next/link";
import { NODE_LIBRARY } from "./templates";
import type { AutomationFlow, AutomationNodeData, ValidationIssue } from "./types";

const inputClass = "w-full rounded-[12px] border border-[#EBE6DF] bg-white px-3 py-2.5 text-sm text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0]";

export function NodeConfigPanel({
  flow,
  selectedNode,
  issues,
  onChange,
  onModeChange
}: {
  flow: AutomationFlow | null;
  selectedNode: AutomationNodeData | null;
  issues: ValidationIssue[];
  onChange: (nodeId: string, key: string, value: string | number | boolean) => void;
  onModeChange: (nodeId: string, value: AutomationNodeData["mode"]) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  if (!flow || !selectedNode) return null;

  const libraryItem = NODE_LIBRARY.flatMap((group) => group.items).find((item) => item.type === selectedNode.type);
  const nodeIssues = issues.filter((issue) => issue.nodeId === selectedNode.id);
  const primaryFields = libraryItem?.fields.slice(0, 2) ?? [];
  const advancedFields = libraryItem?.fields.slice(2) ?? [];
  const saveLabel = flow.lastSavedLabel ?? "Sauvegarde en cours";
  const flowSaved = saveLabel.startsWith("Sauvegardé") || saveLabel.includes("prêt");

  return (
    <aside className="space-y-4 rounded-[28px] border border-[#EBE6DF] bg-white p-5 shadow-[0_12px_30px_rgba(23,19,31,0.07)]">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Configuration</div>
        <h3 className="mt-2 text-[18px] font-extrabold text-[#17131F]">{selectedNode.title}</h3>
        <p className="mt-1 text-[13px] leading-6 text-[#6E6A76]">{selectedNode.description}</p>
      </div>

      {primaryFields.map((field) => (
        <label key={field.key} className="block">
          <span className="mb-1 block text-[12px] font-bold text-[#6E6A76]">{field.label}</span>
          {field.type === "select" ? (
            <select className={inputClass} value={String(selectedNode.config[field.key] ?? "")} onChange={(event) => onChange(selectedNode.id, field.key, event.target.value)}>
              {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : field.type === "boolean" ? (
            <input type="checkbox" checked={Boolean(selectedNode.config[field.key])} onChange={(event) => onChange(selectedNode.id, field.key, event.target.checked)} />
          ) : (
            <input
              className={inputClass}
              type={field.type === "number" ? "number" : "text"}
              value={String(selectedNode.config[field.key] ?? "")}
              onChange={(event) => onChange(selectedNode.id, field.key, field.type === "number" ? Number(event.target.value) : event.target.value)}
            />
          )}
        </label>
      ))}

      {advancedFields.length ? (
        <div className="rounded-[18px] bg-[#F9F7F4] p-4">
          <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="text-sm font-semibold text-[#2B1A4A]">
            {showAdvanced ? "Masquer la configuration avancée" : "Configuration avancée"}
          </button>
          {showAdvanced ? (
            <div className="mt-3 space-y-3">
              {advancedFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-[12px] font-bold text-[#6E6A76]">{field.label}</span>
                  {field.type === "select" ? (
                    <select className={inputClass} value={String(selectedNode.config[field.key] ?? "")} onChange={(event) => onChange(selectedNode.id, field.key, event.target.value)}>
                      {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input className={inputClass} type={field.type === "number" ? "number" : "text"} value={String(selectedNode.config[field.key] ?? "")} onChange={(event) => onChange(selectedNode.id, field.key, field.type === "number" ? Number(event.target.value) : event.target.value)} />
                  )}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedNode.category === "action" ? (
        <label className="block">
          <span className="mb-1 block text-[12px] font-bold text-[#6E6A76]">Niveau d’automatisation</span>
          <select className={inputClass} value={selectedNode.mode ?? "semi_automatic"} onChange={(event) => onModeChange(selectedNode.id, event.target.value as AutomationNodeData["mode"])}>
            <option value="automatic">Automatique</option>
            <option value="semi_automatic">Semi-automatique</option>
            <option value="draft_only">Suggestion uniquement</option>
          </select>
        </label>
      ) : null}

      {nodeIssues.length ? (
        <div className="space-y-2 rounded-[18px] border border-[#F5D5D0] bg-[#FFF5F2] p-4">
          <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#C2492F]">À corriger</div>
          {nodeIssues.map((issue) => (
            <div key={issue.id} className="text-[13px] leading-5 text-[#9F3E28]">
              {issue.message}
              {issue.actionHref && issue.actionLabel ? (
                <div className="mt-2">
                  <Link href={issue.actionHref} className="inline-flex rounded-[8px] bg-[#2B1A4A] px-3 py-2 text-xs font-semibold text-white">
                    {issue.actionLabel}
                  </Link>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-[18px] bg-[#F6F3EF] p-4 text-[13px] leading-6 text-[#6E6A76]">
        Flow : <span className="font-semibold text-[#17131F]">{flow.title}</span><br />
        Version : <span className="font-semibold text-[#17131F]">v{flow.version}</span>
        <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${flowSaved ? "border-[#BFE4CA] bg-[#F0FAF3] text-[#237A44]" : "border-[#DCCEF2] bg-[#F8F5FF] text-[#5B2A9E]"}`}>
          {flowSaved ? <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7C4DCB]" />}
          {saveLabel}
        </div>
      </div>
    </aside>
  );
}
