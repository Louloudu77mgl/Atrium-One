"use client";

import { useFormStatus } from "react-dom";

export function RcuSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="relative w-full rounded-[15px] bg-[var(--rcu-primary)] px-5 py-4 text-sm font-black tracking-[0.01em] text-[var(--rcu-on-primary)] shadow-[0_12px_28px_rgba(40,30,20,0.16)] transition hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Validation en cours…" : label}
    </button>
  );
}
