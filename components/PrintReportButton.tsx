"use client";

import { Icon } from "@/components/icons";

export function PrintReportButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4C1D95] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9] print:hidden">
      <Icon name="document" className="h-4 w-4" />
      Télécharger / imprimer en PDF
    </button>
  );
}
