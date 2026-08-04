"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MerchantLogo({
  merchantName,
  logoUrl,
  className = "h-12 w-12 rounded-xl object-contain bg-white"
}: {
  merchantName: string;
  logoUrl?: string | null;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const canShowLogo = Boolean(logoUrl) && !imageFailed;
  const initials = initialsFor(merchantName);

  useEffect(() => {
    setImageFailed(false);
  }, [logoUrl]);

  if (canShowLogo) {
    return (
      <img
        src={logoUrl ?? ""}
        alt={merchantName}
        className={className}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4C1D95] to-[#A855F7] text-sm font-black text-white">
      {initials || <Icon name="store" className="h-5 w-5" />}
    </div>
  );
}
