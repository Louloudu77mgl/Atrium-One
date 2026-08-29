"use client";

import { Icon } from "@/components/icons";
import type { AutomationFlow } from "./types";

export function AutomationTemplates({
  templates,
  onUse
}: {
  templates: AutomationFlow[];
  onUse: (templateId: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-[#EBE6DF] bg-white p-6 shadow-[0_8px_24px_rgba(23,19,31,0.05)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Recettes Hans prêtes à l’emploi</div>
      <h2 className="mt-2 text-[22px] font-extrabold text-[#17131F]">Choisissez un résultat, puis adaptez le flow</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const requiresBackend = template.nodes.some((node) => node.status === "warning");
          return (
          <article key={template.id} className="rounded-[24px] border border-[#EBE6DF] bg-[#FCFBF9] p-4">
            <div className="rounded-[18px] bg-[linear-gradient(135deg,#F4EEFF_0%,#FFF8F3_100%)] p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#6E4DE0]">{template.channel}</span>
                <Icon name="sparkle" className="h-5 w-5 text-[#6E4DE0]" />
              </div>
              <div className="mt-5 text-[28px]">✨</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#17131F]">{template.installMinutes ?? 4} min</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#17131F]">{template.difficulty ?? "Simple"}</span>
                {requiresBackend ? <span className="rounded-full bg-[#FFF1D9] px-2.5 py-1 text-[11px] font-semibold text-[#8A5A12]">Bientôt</span> : <span className="rounded-full bg-[#EAF7EE] px-2.5 py-1 text-[11px] font-semibold text-[#2E7D4F]">Opérationnel</span>}
              </div>
            </div>
            <h3 className="mt-3 text-[16px] font-extrabold text-[#17131F]">{template.title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-[#6E6A76]">{template.summary}</p>
            <button type="button" onClick={() => onUse(template.id)} className="mt-4 inline-flex rounded-[10px] bg-[#2B1A4A] px-4 py-2 text-sm font-semibold text-white">
              Utiliser ce scénario
            </button>
          </article>
          );
        })}
      </div>
    </section>
  );
}
