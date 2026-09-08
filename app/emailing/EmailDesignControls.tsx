"use client";

import { fieldStyles } from "@/lib/design-system";
import { normalizeEmailDesign } from "@/lib/emailing-design";
import type { EmailCampaignContent, EmailDesign } from "@/lib/emailing-types";

export function EmailDesignControls({ content, onChange }: { content: EmailCampaignContent; onChange: (content: EmailCampaignContent) => void }) {
  const design = normalizeEmailDesign(content.design);
  const set = <K extends keyof EmailDesign>(key: K, value: EmailDesign[K]) => onChange({ ...content, design: { ...design, [key]: value } });
  return <fieldset className="space-y-4 rounded-2xl border border-[#DED7E8] bg-white p-4">
    <legend className="px-2 text-sm font-black text-[#211432]">Mise en page du design</legend>
    <label className="grid gap-2 text-sm font-bold text-[#51485F]">Police<select value={design.font} onChange={(event) => set("font", event.target.value as EmailDesign["font"])} className={fieldStyles.input}><option value="arial">Arial · Moderne</option><option value="georgia">Georgia · Éditoriale</option><option value="verdana">Verdana · Lisible</option></select></label>
    <label className="grid gap-2 text-sm font-bold text-[#51485F]">Alignement<select value={design.alignment} onChange={(event) => set("alignment", event.target.value as EmailDesign["alignment"])} className={fieldStyles.input}><option value="left">À gauche</option><option value="center">Centré</option><option value="right">À droite</option></select></label>
    <div className="grid grid-cols-2 gap-4">{([
      ["textSize", "Taille du texte", 12, 24, 1], ["headingSize", "Taille du titre", 20, 48, 1],
      ["width", "Largeur", 480, 800, 20], ["padding", "Espacement", 16, 56, 2], ["radius", "Arrondis", 0, 40, 2]
    ] as const).map(([key, label, min, max, step]) => <label key={key} className="grid gap-2 text-sm font-bold text-[#51485F]">{label}<span className="text-xs font-medium text-[#736A80]">{design[key]} px</span><input type="range" min={min} max={max} step={step} value={design[key]} onChange={(event) => set(key, Number(event.target.value))} className="w-full accent-[#7C3AED]" /></label>)}
      <label className="grid gap-2 text-sm font-bold text-[#51485F]">Couleur du texte<input type="color" value={design.textColor} onChange={(event) => set("textColor", event.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-[#DED7E8] p-1" /></label>
    </div>
    <label className="grid gap-2 text-sm font-bold text-[#51485F]">Position du visuel<select value={design.imagePosition} onChange={(event) => set("imagePosition", event.target.value as EmailDesign["imagePosition"])} className={fieldStyles.input}><option value="top">Au-dessus du titre</option><option value="below_heading">Sous le titre</option></select></label>
  </fieldset>;
}
