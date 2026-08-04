import { Icon } from "@/components/icons";
import type { Kpi } from "@/lib/mock-data";

const trendClasses = {
  up: "bg-[#F0FDF4] text-[#15803D] ring-[#BBF7D0]",
  down: "bg-[#FEF2F2] text-[#DC2626] ring-[#FECACA]",
  neutral: "bg-[#F5F0FF] text-[#7C3AED] ring-[#E9D5FF]"
};

const accentClasses = {
  purple: {
    icon: "bg-[#F3E8FF] text-[#6D28D9] ring-[#E9D5FF]",
    glow: "from-[#7C3AED]/12"
  },
  red: {
    icon: "bg-[#FEF2F2] text-[#DC2626] ring-[#FECACA]",
    glow: "from-[#DC2626]/10"
  },
  green: {
    icon: "bg-[#F0FDF4] text-[#15803D] ring-[#BBF7D0]",
    glow: "from-[#16A34A]/10"
  },
  amber: {
    icon: "bg-[#FFFBEB] text-[#B45309] ring-[#FDE68A]",
    glow: "from-[#F59E0B]/10"
  }
};

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const iconName = getIconName(kpi);
  const accent = accentClasses[kpi.accent ?? (kpi.valueTone === "danger" ? "red" : "purple")];

  return (
    <article className="group relative overflow-hidden rounded-[18px] border border-[#E9D5FF] bg-white p-4 shadow-[0_8px_24px_rgba(76,29,149,0.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#D8B4FE] hover:shadow-[0_16px_38px_rgba(76,29,149,0.13)]">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${accent.glow} to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="relative mb-4 flex items-start justify-between gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ring-1 transition duration-300 group-hover:scale-105 ${accent.icon}`}>
          <Icon name={iconName} className="h-4.5 w-4.5" />
        </div>
        {kpi.trend ? (
          <span className={`inline-flex max-w-[132px] items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 transition duration-300 group-hover:scale-[1.02] ${trendClasses[kpi.trendTone ?? "neutral"]}`}>
            {kpi.trend}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8B7AA8]">{kpi.label}</div>
        <div
          className={`mb-1.5 font-black leading-none tracking-[-0.04em] transition-colors duration-300 ${
            kpi.compact ? "text-[21px]" : "text-[28px]"
          } ${kpi.valueTone === "danger" ? "text-[#DC2626]" : "text-[#211432]"}`}
        >
          {kpi.value}
          {kpi.unit ? <span className="ml-1 text-sm font-bold tracking-normal text-[#6B617F]">{kpi.unit}</span> : null}
        </div>
        <p className="min-h-[18px] text-xs font-medium leading-5 text-[#6B617F]">{kpi.subtext ?? kpi.stars ?? "Donnée calculée en temps réel"}</p>
      </div>
    </article>
  );
}

function getIconName(kpi: Kpi): Parameters<typeof Icon>[0]["name"] {
  if (kpi.icon === "check" || kpi.icon === "sparkle") {
    return kpi.icon;
  }

  if (kpi.label === "Note moyenne") return "star";
  if (kpi.label === "Total des avis") return "message";
  if (kpi.label === "À traiter") return "inbox";
  if (kpi.label === "Répondus") return "check";
  if (kpi.label === "Sentiment") return "chart";
  if (kpi.label === "Négatifs") return "alert";
  if (kpi.label === "Prêts à publier") return "check";
  if (kpi.label === "Réponses générées") return "sparkle";
  return "chart";
}
