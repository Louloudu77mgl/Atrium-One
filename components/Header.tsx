"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { MerchantLogo } from "@/components/MerchantLogo";
import { merchant } from "@/lib/mock-data";
import type { AppNotification } from "@/lib/notifications";
import type { ReviewCounters } from "@/lib/review-counters";
import type { GoogleConnectionRow, MerchantRow } from "@/lib/supabase/types";

export function Header({
  merchant: currentMerchant,
  googleConnection,
  counters,
  notifications = []
}: {
  merchant?: MerchantRow | null;
  googleConnection?: GoogleConnectionRow | null;
  counters?: ReviewCounters;
  notifications?: AppNotification[];
}) {
  const [syncing, setSyncing] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const businessName = currentMerchant?.business_name ?? merchant.name;
  const businessType = currentMerchant?.business_type ?? merchant.category;
  const city = currentMerchant?.city ?? merchant.address;
  const googleConnected = googleConnection?.status === "connected";
  const importantNotifications = notifications.filter((notification) => notification.id !== "all-clear");
  const notificationCount = importantNotifications.filter((notification) => !readNotifications.includes(notification.id)).length;
  const notificationsRef = useRef<HTMLDivElement>(null);
  const syncTimeoutRef = useRef<number | null>(null);

  function sync() {
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    setSyncing(true);
    syncTimeoutRef.current = window.setTimeout(() => {
      setSyncing(false);
      syncTimeoutRef.current = null;
    }, 1200);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    if (notificationsOpen) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [notificationsOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#E9D5FF] bg-white/90 px-4 backdrop-blur md:px-7">
      <div className="flex flex-1 items-center gap-3">
        <MerchantLogo merchantName={businessName} logoUrl={currentMerchant?.logo_url} />
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{businessName}</div>
          <div className="truncate text-xs text-[#6B617F]">
            {businessType} · {city}
          </div>
        </div>
      </div>

      <div className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold lg:flex ${googleConnected ? "bg-[#F3E8FF] text-[#7C3AED]" : "bg-[#F5F0FF] text-[#6B617F]"}`}>
        <span className={`h-[7px] w-[7px] rounded-full ${googleConnected ? "bg-[#7C3AED] [animation:pulse-dot_2s_infinite]" : "bg-[#A855F7]"}`} />
        {googleConnected ? "Connecté à Google Fiche Business" : "Google Fiche Business non connecté"}
      </div>

      <div ref={notificationsRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setNotificationsOpen((open) => !open);
            setReadNotifications((current) => [...new Set([...current, ...importantNotifications.map((notification) => notification.id)])]);
          }}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F5F0FF] text-[#4C1D95] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#F3E8FF] hover:shadow-[0_10px_24px_rgba(76,29,149,0.12)]"
          aria-label="Notifications"
        >
          <Icon name="bell" className="h-4.5 w-4.5" />
          {notificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-black text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          ) : null}
        </button>

        {notificationsOpen ? (
          <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[#E9D5FF] bg-white p-3 shadow-[0_18px_50px_rgba(76,29,149,0.18)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <div>
                <strong className="text-sm text-[#211432]">Centre de notifications</strong>
                <p className="mt-0.5 text-[11px] text-[#8B7AA8]">Actions importantes du module Avis Google IA</p>
              </div>
              <span className="rounded-full bg-[#F5F0FF] px-2 py-0.5 text-[10px] font-bold text-[#7C3AED]">{importantNotifications.length}</span>
            </div>
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Link key={notification.id} href={notification.href} onClick={() => setNotificationsOpen(false)} className="block rounded-xl border border-[#F3F0FF] bg-[#FBFAFF] p-3 transition hover:border-[#DDD6FE] hover:bg-[#F5F0FF]">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-[#211432]">{notification.title}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#7C3AED]">{notification.actionLabel}</span>
                  </div>
                  <p className="text-xs leading-5 text-[#6B617F]">{notification.description}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={sync}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F5F0FF] px-3 py-2 text-[13px] font-semibold text-[#4C1D95] transition hover:bg-[#F3E8FF] sm:px-4"
      >
        <Icon name="refresh" className={`h-4 w-4 ${syncing ? "[animation:spin-once_0.8s_linear_infinite]" : ""}`} />
        <span className="hidden sm:inline">Synchroniser</span>
      </button>
    </header>
  );
}
