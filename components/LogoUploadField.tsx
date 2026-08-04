"use client";

import { useState } from "react";

export function LogoUploadField({
  currentLogoUrl,
  businessName
}: {
  currentLogoUrl?: string | null;
  businessName?: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl ?? null);

  function updatePreview(file?: File) {
    if (!file) {
      setPreview(currentLogoUrl ?? null);
      return;
    }

    setPreview(URL.createObjectURL(file));
  }

  const initials = (businessName ?? "AO")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-xs font-semibold text-[#6B617F]">Logo de votre enseigne</span>
      <div className="flex flex-col gap-3 rounded-[14px] border border-dashed border-[#C4B5FD] bg-[#FBFAFF] p-4 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#4C1D95] to-[#A855F7] text-sm font-black text-white">
          {preview ? <img src={preview} alt="Aperçu du logo" className="h-full w-full object-cover" /> : initials}
        </div>
        <div className="min-w-0 flex-1">
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={(event) => updatePreview(event.currentTarget.files?.[0])}
            className="block w-full text-sm text-[#6B617F] file:mr-3 file:rounded-lg file:border-0 file:bg-[#4C1D95] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#6D28D9]"
          />
          <p className="mt-2 text-xs leading-5 text-[#8B7AA8]">PNG, JPG, SVG ou WEBP. Le logo sera affiché dans le header, la sidebar et le profil commerce.</p>
        </div>
      </div>
    </label>
  );
}
