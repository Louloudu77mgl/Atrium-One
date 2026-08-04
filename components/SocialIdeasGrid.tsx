"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreatePostButton } from "@/components/CreatePostButton";
import type { ReviewSocialPostIdea } from "@/lib/review-insights";
import { buildCreatePostHref } from "@/lib/social-recommendations";

export function SocialIdeasGrid({
  ideas,
  emptyTitle,
  emptyDescription,
  emptyHref,
  emptyLabel
}: {
  ideas: ReviewSocialPostIdea[];
  emptyTitle: string;
  emptyDescription: string;
  emptyHref?: string;
  emptyLabel?: string;
}) {
  const [visibleCount, setVisibleCount] = useState<3 | 6 | "all">(3);
  const visibleIdeas = useMemo(() => visibleCount === "all" ? ideas : ideas.slice(0, visibleCount), [ideas, visibleCount]);

  if (ideas.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-[#D8B4FE] bg-white p-6 text-sm text-[#6B617F]">
        <div className="mb-1 text-base font-black text-[#211432]">{emptyTitle}</div>
        <p>{emptyDescription}</p>
        {emptyHref && emptyLabel ? (
          <Link href={emptyHref} className="mt-4 inline-flex rounded-xl bg-[#4C1D95] px-4 py-2.5 text-sm font-bold text-white">
            {emptyLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#6B617F]">{ideas.length} recommandation{ideas.length > 1 ? "s" : ""} disponible{ideas.length > 1 ? "s" : ""}</p>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B617F]">
          Affichage
          <select
            value={String(visibleCount)}
            onChange={(event) => setVisibleCount(event.target.value === "all" ? "all" : Number(event.target.value) as 3 | 6)}
            className="rounded-xl border border-[#E9D5FF] bg-white px-3 py-2 text-sm font-semibold text-[#211432] outline-none"
          >
            <option value="3">3 idées</option>
            <option value="6">6 idées</option>
            <option value="all">Toutes</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {visibleIdeas.map((idea, index) => {
          const source = idea.sourcePainPoint ?? idea.sourceStrength ?? idea.seasonalMoment ?? "Insight client";
          const href = buildCreatePostHref(idea);

          return (
            <article key={`${idea.platform}-${idea.title}-${index}`} className="group rounded-[22px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)] transition duration-300 hover:-translate-y-1 hover:border-[#D8B4FE] hover:shadow-[0_18px_42px_rgba(76,29,149,0.12)]">
              {idea.assetUrl ? (
                <img src={idea.assetUrl} alt={idea.assetAltText ?? idea.title} className="mb-4 h-40 w-full rounded-2xl object-cover" />
              ) : null}
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-black capitalize text-[#7C3AED]">{idea.platform}</span>
                <span className="rounded-full bg-[#FBFAFF] px-3 py-1 text-xs font-bold text-[#8B7AA8]">{idea.seasonalMoment ? "Saisonnier" : "Hans"}</span>
              </div>
              <h3 className="text-base font-black text-[#211432]">{idea.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6B617F]">{idea.angle}</p>
              <div className="mt-4 rounded-2xl bg-[#FBFAFF] p-3 text-xs leading-5 text-[#6B617F]">
                <strong className="text-[#4C1D95]">Source : </strong>{source}
              </div>
              <CreatePostButton href={href} className="mt-5 inline-flex rounded-xl bg-[#4C1D95] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#6D28D9]" />
            </article>
          );
        })}
      </div>
    </div>
  );
}
