"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";
import { MerchantLogo } from "@/components/MerchantLogo";
import { merchant } from "@/lib/mock-data";
import type { ReviewCounters } from "@/lib/review-counters";
import type { MerchantRow } from "@/lib/supabase/types";

type SidebarItem = {
  href?: string;
  icon: ComponentProps<typeof Icon>["name"];
  label: string;
  disabled?: boolean;
  badge?: string;
  badgeTone?: "amber" | "red";
};

type SidebarGroup = {
  id: "reviews" | "social" | "loyalty" | "settings";
  icon: ComponentProps<typeof Icon>["name"];
  label: string;
  items: SidebarItem[];
};

const groups: SidebarGroup[] = [
  {
    id: "reviews",
    icon: "star",
    label: "Module Avis",
    items: [
      { href: "/reviews", icon: "star", label: "Avis", badge: "0", badgeTone: "red" },
      { href: "/reviews/insights", icon: "chart", label: "Insights IA" }
    ]
  },
  {
    id: "social",
    icon: "phone",
    label: "Réseaux Sociaux",
    items: [
      { href: "/social", icon: "phone", label: "Instagram" },
      { icon: "store", label: "Facebook", disabled: true }
    ]
  },
  {
    id: "loyalty",
    icon: "message",
    label: "Fidélisation Clients",
    items: [
      { href: "/fidelisation/clients", icon: "inbox", label: "Base de données clients" },
      { href: "/emailing", icon: "mail", label: "E-mailing" },
      { href: "/sms-campaigns", icon: "lock", label: "SMS", disabled: true, badge: "Disponible prochainement" },
      { href: "/rcu", icon: "document", label: "RCU" }
    ]
  },
  {
    id: "settings",
    icon: "gear",
    label: "Paramètres",
    items: [
      { href: "/automations", icon: "sparkle", label: "Automatisations" },
      { href: "/integrations", icon: "store", label: "Intégrations" },
      { href: "/settings", icon: "gear", label: "Réglages" }
    ]
  }
];

function isItemActive(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (href === "/reviews") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  merchant: currentMerchant,
  pendingReviews = 0,
  counters
}: {
  active?: "dashboard" | "reviews" | "insights" | "social" | "sms" | "emailing" | "rcu" | "clients" | "automations" | "integrations" | "settings";
  merchant?: MerchantRow | null;
  pendingReviews?: number;
  counters?: ReviewCounters;
}) {
  const pathname = usePathname();
  const reviewBadgeCount = counters?.pending ?? pendingReviews;
  const businessName = currentMerchant?.business_name ?? merchant.name;
  const activeGroup = groups.find((group) => group.items.some((item) => isItemActive(pathname, item.href)))?.id;
  const [openGroups, setOpenGroups] = useState<Record<SidebarGroup["id"], boolean>>({
    reviews: activeGroup === "reviews",
    social: activeGroup === "social",
    loyalty: activeGroup === "loyalty",
    settings: activeGroup === "settings"
  });

  function toggleGroup(groupId: SidebarGroup["id"]) {
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-[#4C1D95] md:flex">
        <div className="border-b border-white/10 px-5 pb-[18px] pt-[22px]">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <img src="/atriumone-logo.webp" alt="AtriumOne" className="h-[38px] w-[38px] object-contain drop-shadow-sm" />
            <span className="text-[17px] font-bold text-white">
              Atrium<span className="text-[#C084FC]">One</span>
            </span>
          </Link>
        </div>

        <nav className="px-3 pb-3 pt-[18px]">
          <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.9px] text-white/35">
            Navigation
          </div>

          <Link
            href="/dashboard"
            className={`relative mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition hover:bg-white/10 hover:text-white ${
              pathname === "/dashboard" ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:h-3/5 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-[#C084FC]" : "text-white/60"
            }`}
          >
            <Icon name="home" className="h-5 w-5 shrink-0" />
            <span>Accueil</span>
          </Link>

          <div className="space-y-1">
            {groups.map((group) => {
              const groupActive = group.id === activeGroup;
              const isOpen = openGroups[group.id];

              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition hover:bg-white/10 hover:text-white ${
                      groupActive ? "text-white" : "text-white/65"
                    }`}
                  >
                    <Icon name={group.icon} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                    <span className={`text-[11px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>⌄</span>
                  </button>

                  {isOpen ? (
                    <div className="mb-1 ml-5 space-y-0.5 border-l border-white/15 pl-2">
                      {group.items.map((item) => {
                        const isActive = isItemActive(pathname, item.href);
                        const dynamicBadge = item.href === "/reviews" ? reviewBadgeCount : item.badge;
                        const shouldShowBadge = Boolean(item.badge) && (item.href === "/reviews" ? Number(dynamicBadge) > 0 : true);

                        if (item.disabled) {
                          return (
                            <div key={item.label} className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium text-white/30">
                              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              <span className="max-w-[88px] rounded-full bg-white/10 px-1.5 py-0.5 text-center text-[8px] font-bold leading-3 text-white/45">{item.badge ?? "Bientôt"}</span>
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={item.label}
                            href={item.href!}
                            className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium transition hover:bg-white/10 hover:text-white ${
                              isActive ? "bg-white/10 text-white" : "text-white/55"
                            }`}
                          >
                            {item.href === "/reviews/insights" ? (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10">
                                <HansAvatar size={15} />
                              </span>
                            ) : (
                              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {shouldShowBadge ? (
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.badgeTone === "amber" ? "bg-white text-[#4C1D95]" : "bg-[#DC2626] text-white"}`}>
                                {dynamicBadge}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto border-t border-white/10 p-3.5">
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 transition hover:bg-white/10">
            <MerchantLogo merchantName={businessName} logoUrl={currentMerchant?.logo_url} className="h-12 w-12 rounded-xl bg-white object-contain" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-white">{businessName}</div>
              <div className="text-[11px] text-white/40">{merchant.plan} ✦</div>
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#E9D5FF] bg-white/95 px-2 py-2 shadow-[0_-8px_24px_rgba(76,29,149,0.08)] backdrop-blur md:hidden">
        {[
          { href: "/dashboard", icon: "home", label: "Accueil" },
          { href: "/reviews", icon: "star", label: "Avis" },
          { href: "/social", icon: "phone", label: "Réseaux" },
          { href: "/emailing", icon: "mail", label: "Fidélisation" },
          { href: "/settings", icon: "gear", label: "Paramètres" }
        ].map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold text-[#6B617F] transition hover:bg-[#F3F0FF] hover:text-[#4C1D95]">
            <Icon name={item.icon as ComponentProps<typeof Icon>["name"]} className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
