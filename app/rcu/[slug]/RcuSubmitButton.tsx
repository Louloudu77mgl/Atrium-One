"use client";

import { useFormStatus } from "react-dom";

export function RcuSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full overflow-hidden rounded-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--rcu-primary)_32%,#241040),color-mix(in_srgb,var(--rcu-accent)_42%,#241040))] px-5 py-4 text-sm font-black uppercase tracking-[0.04em] text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
    >
      <span className="absolute inset-y-0 -left-1/2 w-2/5 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition duration-700 group-hover:left-[120%]" />
      <span className="relative">{pending ? "Validation en cours…" : label}</span>
    </button>
  );
}
