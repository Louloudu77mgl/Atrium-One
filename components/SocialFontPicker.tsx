"use client";

import { useMemo, useState } from "react";
import { SOCIAL_FONTS, getSocialFontStack } from "@/lib/social-fonts";

export function SocialFontPicker({ value, onChange, name }: { value: string; onChange: (value: string) => void; name?: string }) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => SOCIAL_FONTS.reduce<Record<string, typeof SOCIAL_FONTS>>((result, font) => {
    (result[font.category] ??= []).push(font);
    return result;
  }, {}), []);

  return (
    <div className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between rounded-[12px] border border-[#E4DBF6] bg-white px-4 py-2 text-left outline-none transition hover:border-[#BDA8E8] focus:ring-2 focus:ring-[#6E4DE0]/30"
      >
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Police sélectionnée</span>
          <span className="block text-[18px] leading-6 text-[#17131F]" style={{ fontFamily: getSocialFontStack(value) }}>{value} · Belle histoire</span>
        </span>
        <span className="text-[#6E4DE0]">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="relative z-50 mt-2 rounded-[16px] border border-[#E4DBF6] bg-white p-3 shadow-[0_20px_60px_rgba(43,26,74,0.18)]">
          {Object.entries(groups).map(([category, fonts]) => (
            <div key={category} className="mb-3 last:mb-0">
              <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[#9A96A1]">{category}</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {fonts?.map((font) => (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => { onChange(font.value); setOpen(false); }}
                    className={`rounded-[10px] border px-3 py-2 text-left transition ${value === font.value ? "border-[#6E4DE0] bg-[#F1ECFB]" : "border-[#EEE8F5] hover:border-[#CDBBEA] hover:bg-[#FBFAFF]"}`}
                  >
                    <span className="block text-[10px] font-semibold text-[#8B87A0]">{font.label}</span>
                    <span className="block truncate text-[17px] leading-6 text-[#211432]" style={{ fontFamily: font.stack }}>Aa Gourmandise</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
