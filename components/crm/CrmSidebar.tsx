"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/crm", label: "Accueil", icon: "⌂", exact: true },
  { href: "/crm/prospection", label: "Prospection", icon: "⌕" },
  { href: "/crm/leads", label: "Base de données", icon: "▦" },
  { href: "/crm/calendar", label: "Calendrier", icon: "□" },
  { href: "/crm/archives", label: "Archives", icon: "◇" }
];

export function CrmSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-[#E8E4DB] bg-[#211432] md:flex">
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/crm" className="flex items-center gap-2.5">
          <img src="/atriumone-logo.webp" alt="AtriumOne" className="h-9 w-9 object-contain" />
          <span className="text-[16px] font-black text-white">Atrium<span className="text-[#C084FC]">One</span></span>
        </Link>
        <div className="mt-3 inline-flex rounded-md bg-[#A855F7]/15 px-2 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#D8B4FE]">CRM interne</div>
      </div>
      <nav className="space-y-1 p-3">
        {links.map((item) => {
          const active = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
          return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-bold transition ${active ? "bg-white text-[#211432]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}><span className="w-5 text-center text-base">{item.icon}</span>{item.label}</Link>;
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 p-4">
        <div className="truncate text-[11px] font-semibold text-white/45">{email}</div>
        <form action="/auth/signout" method="post" className="mt-2">
          <button className="text-xs font-bold text-white/70 hover:text-white">Se déconnecter</button>
        </form>
      </div>
    </aside>
  );
}

export function CrmMobileNav() {
  const pathname = usePathname();
  return <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[#E8E4DB] bg-white/95 p-2 backdrop-blur md:hidden">{links.map((item) => { const active = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`)); return <Link key={item.href} href={item.href} className={`rounded-lg px-1 py-2 text-center text-[10px] font-bold ${active ? "bg-[#F3E8FF] text-[#4C1D95]" : "text-[#6B617F]"}`}><span className="block text-base">{item.icon}</span>{item.label}</Link>; })}</nav>;
}
