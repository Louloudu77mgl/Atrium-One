"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { NODE_LIBRARY } from "./templates";

const TABS = [
  "Déclencheurs",
  "Actions IA",
  "Instagram",
  "Google",
  "Emails",
  "CRM",
  "Conditions",
  "Notifications",
  "Favoris",
  "Récents"
] as const;

export function NodeLibrary({
  onAdd,
  favorites,
  recentTypes,
  onToggleFavorite
}: {
  onAdd: (type: string) => void;
  favorites: string[];
  recentTypes: string[];
  onToggleFavorite: (type: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Déclencheurs");
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const allItems = NODE_LIBRARY.flatMap((group) => group.items);
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
    return allItems.filter((item) => {
      const inTab = matchesTab(item, activeTab, favorites, recentTypes);
      if (!inTab) return false;
      if (!normalizedQuery) return true;
      return `${item.title} ${item.description} ${item.provider ?? ""} ${(item.tags ?? []).join(" ")}`.toLocaleLowerCase("fr-FR").includes(normalizedQuery);
    });
  }, [activeTab, favorites, query, recentTypes]);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-white p-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Bibliothèque</div>
        <h2 className="mt-1 text-[18px] font-extrabold text-[#17131F]">Blocs à glisser</h2>
        <p className="mt-1 text-[13px] leading-5 text-[#6E6A76]">Un onglet à la fois, pour rester concentré.</p>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un bloc"
        className="rounded-[14px] border border-[#EBE6DF] bg-[#F9F7F4] px-4 py-3 text-sm text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0]"
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-2 text-[12px] font-semibold ${activeTab === tab ? "bg-[#2B1A4A] text-white" : "bg-[#F6F3EF] text-[#17131F]"}`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto pr-1">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">{activeTab}</div>
          <div className="text-[12px] text-[#6E6A76]">{items.length} bloc(s)</div>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.type}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/atrium-node", item.type);
              }}
              onClick={() => onAdd(item.type)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onAdd(item.type);
                }
              }}
              className="flex w-full cursor-pointer items-start gap-3 rounded-[20px] border border-[#EBE6DF] bg-[#F9F7F4] px-3 py-3 text-left transition hover:border-[#6E4DE0] hover:bg-[#FBF8FF] focus:outline-none focus:ring-2 focus:ring-[#6E4DE0]"
            >
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: item.color }}>
                <Icon name={item.icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-[#17131F]">{item.title}</div>
                <div className="mt-1 text-[12px] leading-5 text-[#6E6A76]">{item.description}</div>
                <div className="mt-2 text-[11px] font-semibold text-[#9A96A1]">{item.provider ?? "Hans"}</div>
              </div>
              <button
                type="button"
                aria-label="Ajouter aux favoris"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(item.type);
                }}
                className={`rounded-full p-1.5 ${favorites.includes(item.type) ? "bg-[#F1ECFB] text-[#6E4DE0]" : "bg-white text-[#9A96A1]"}`}
              >
                <Icon name="star" className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!items.length ? <div className="rounded-[18px] border border-dashed border-[#EBE6DF] bg-[#F9F7F4] p-4 text-[13px] text-[#6E6A76]">Aucun bloc ne correspond à cette recherche.</div> : null}
        </div>
      </div>
    </aside>
  );
}

function matchesTab(item: (typeof NODE_LIBRARY)[number]["items"][number], tab: (typeof TABS)[number], favorites: string[], recentTypes: string[]) {
  if (tab === "Favoris") return favorites.includes(item.type);
  if (tab === "Récents") return recentTypes.includes(item.type);
  if (tab === "Déclencheurs") return item.category === "trigger";
  if (tab === "Conditions") return item.category === "condition" || item.category === "control";
  return item.provider === tab || item.tags?.includes(tab.toLocaleLowerCase("fr-FR")) || false;
}
