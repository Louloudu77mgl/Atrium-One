"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function moduleForPath(pathname: string) {
  if (pathname.startsWith("/reviews/insights")) return "insights";
  if (pathname.startsWith("/reviews")) return "reviews";
  if (pathname.startsWith("/social") || pathname.startsWith("/integrations/instagram")) return "instagram";
  if (pathname.startsWith("/settings/hans")) return "hans";
  if (pathname.startsWith("/automations")) return "automations";
  if (pathname.startsWith("/emailing")) return "emailing";
  if (pathname.startsWith("/rcu")) return "rcu";
  if (pathname.startsWith("/fidelisation")) return "customers";
  return null;
}

export function PendingOnboardingBanner({ pending, modules, bookingUrl }: { pending: boolean; modules: Record<string, boolean>; bookingUrl: string | null }) {
  const pathname = usePathname();
  const [showGate, setShowGate] = useState(false);
  const feature = moduleForPath(pathname);
  const moduleLocked = Boolean(feature && modules[feature] === false);
  const active = (pending || moduleLocked) && !pathname.startsWith("/crm") && !pathname.startsWith("/login") && !pathname.startsWith("/signup") && !pathname.startsWith("/onboarding");

  useEffect(() => {
    if (!active) return;
    const blockSubmit = (event: SubmitEvent) => { const form = event.target as HTMLFormElement; if (form.closest("[data-onboarding-allowed]")) return; event.preventDefault(); event.stopImmediatePropagation(); setShowGate(true); };
    const blockButton = (event: MouseEvent) => { const target = event.target as HTMLElement; const button = target.closest("button"); if (!button || button.hasAttribute("aria-expanded") || button.closest("[data-onboarding-allowed]")) return; event.preventDefault(); event.stopImmediatePropagation(); setShowGate(true); };
    document.addEventListener("submit", blockSubmit, true); document.addEventListener("click", blockButton, true);
    return () => { document.removeEventListener("submit", blockSubmit, true); document.removeEventListener("click", blockButton, true); };
  }, [active]);

  if (!active) return null;

  return (
    <><div data-onboarding-allowed className="sticky top-0 z-[60] border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black">{pending ? "Votre espace AtriumOne est presque prêt." : "Ce module n’est pas encore activé."}</div>
          <div className="mt-0.5 text-xs font-medium text-amber-800">Un onboarding est nécessaire avant d’activer vos outils et automatisations.</div>
        </div>
        {bookingUrl ? (
          <a href={bookingUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#4C1D95] px-3.5 py-2 text-xs font-bold text-white">Prendre RDV pour l’onboarding</a>
        ) : (
          <span className="rounded-lg border border-amber-300 px-3.5 py-2 text-xs font-bold">Prendre RDV — lien à configurer</span>
        )}
      </div>
    </div>{showGate ? <div data-onboarding-allowed className="ao-modal-backdrop z-[80]"><div className="ao-modal-content max-w-md p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E8FF] text-xl">🔒</div><h2 className="mt-4 text-lg font-black">Fonctionnalité en attente d’activation</h2><p className="mt-2 text-sm leading-6 text-[#6B617F]">Cette fonctionnalité sera activée pendant votre onboarding.</p><div className="mt-5 flex justify-center gap-2">{bookingUrl ? <a href={bookingUrl} target="_blank" rel="noreferrer" className="ao-btn-primary px-4 py-2.5 text-xs font-black">Prendre RDV pour l’onboarding</a> : null}<button onClick={() => setShowGate(false)} className="ao-btn-secondary px-4 py-2.5 text-xs font-black">Fermer</button></div></div></div> : null}</>
  );
}
