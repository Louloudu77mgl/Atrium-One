"use client";

import Link from "next/link";
import { useState } from "react";
import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";
import { SocialIdeasGrid } from "@/components/SocialIdeasGrid";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/Skeleton";
import { buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import type { ReviewInsightsAnalysis, ReviewSocialPostIdea } from "@/lib/review-insights";

export function ReviewInsightsCards({
  analysis,
  compact = false,
  isLoading = false,
  error
}: {
  analysis: ReviewInsightsAnalysis | null;
  compact?: boolean;
  isLoading?: boolean;
  error?: string | null;
}) {
  const hasData = Boolean(
    analysis &&
      (analysis.painPoints.length > 0 ||
        analysis.strengths.length > 0 ||
        analysis.priorityActions.length > 0 ||
        analysis.socialPostIdeas.length > 0)
  );

  if (isLoading) {
    return <HansAnalysisLoading />;
  }

  if (!hasData) {
    return (
      <section className={`${surfaceStyles.empty} p-6`}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3E8FF]">
          <HansAvatar size={42} />
        </div>
        <h2 className={typographyStyles.h3}>{error ? "Hans n’a pas pu terminer l’analyse" : "Hans prépare vos prochains repères"}</h2>
        <p className={`${typographyStyles.body} mt-2 max-w-2xl`}>
          {error ?? "L’analyse se lance automatiquement dès que des avis sont disponibles. Les douleurs clients, points forts et actions prioritaires apparaîtront ici."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className={`${typographyStyles.kicker} mb-1`}>Hans a analysé vos avis</p>
          <h2 className={typographyStyles.h2}>Ce que vos clients disent vraiment</h2>
        </div>
        {!compact ? (
          <Link href="/reviews/insights" className={buttonStyles.tertiary}>
            Voir plus de détails
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <InsightColumn
          title="Douleurs principales"
          icon="alert"
          tone="red"
          kind="pain"
          items={analysis!.painPoints.map((item) => ({
            title: item.title,
            meta: `Fréquence : ${capitalize(item.frequency)}`,
            body: item.summary,
            examples: item.examples,
            footer: item.recommendation
          }))}
        />
        <InsightColumn
          title="Points forts à valoriser"
          icon="star"
          tone="green"
          kind="strength"
          items={analysis!.strengths.map((item) => ({
            title: item.title,
            meta: "Point fort",
            body: item.summary,
            examples: item.examples,
            footer: `Opportunité : ${item.communicationAngle}`
          }))}
        />
        <ActionsColumn
          title="Actions prioritaires"
          icon="check"
          items={analysis!.priorityActions.slice(0, 3).map((item) => ({
            title: item.title,
            impact: capitalize(item.impact),
            difficulty: capitalize(item.difficulty)
          }))}
        />
      </div>
    </section>
  );
}

export function HansAnalysisLoading() {
  return (
    <section className={`${surfaceStyles.section} p-6`} aria-busy="true" aria-label="Analyse des avis en cours">
      <div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-2xl" /><div className="flex-1"><Skeleton className="h-5 w-52" /><SkeletonText className="mt-3 max-w-xl" /></div></div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <SkeletonCard key={index} className="min-h-48" />)}</div>
    </section>
  );
}

export function SocialPostIdeasGrid({
  ideas,
  isLoading = false,
  emptyCta = true
}: {
  ideas: ReviewSocialPostIdea[];
  isLoading?: boolean;
  emptyCta?: boolean;
}) {
  if (isLoading) {
    return (
      <div className={`${surfaceStyles.section} p-6`}>
        <div className="flex items-center gap-3">
          <HansAvatar size={42} />
          <div>
            <div className={typographyStyles.h3}>Hans prépare les idées de posts...</div>
            <div className={`${typographyStyles.caption} mt-1`}>Les idées apparaissent juste après l’analyse des avis.</div>
          </div>
        </div>
      </div>
    );
  }

  if (ideas.length === 0) {
    return <SocialIdeasGrid ideas={ideas} emptyTitle="Aucune idée de post pour le moment" emptyDescription="Hans va transformer les retours clients en contenus Instagram et Facebook dès que l’analyse sera disponible." emptyHref={emptyCta ? "/reviews/insights" : undefined} emptyLabel={emptyCta ? "Voir l’analyse" : undefined} />;
  }

  return <SocialIdeasGrid ideas={ideas} emptyTitle="Aucune idée de post pour le moment" emptyDescription="Hans va transformer les retours clients en contenus Instagram et Facebook dès que l’analyse sera disponible." />;
}

function InsightColumn({
  title,
  icon,
  tone,
  kind,
  items
}: {
  title: string;
  icon: Parameters<typeof Icon>[0]["name"];
  tone: "red" | "purple" | "green";
  kind: "pain" | "strength";
  items: { title: string; meta: string; body: string; examples: string[]; footer: string }[];
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const toneClasses = {
    red: "bg-[#FEF2F2] text-[#DC2626]",
    purple: "bg-[#F3E8FF] text-[#7C3AED]",
    green: "bg-[#F0FDF4] text-[#15803D]"
  };
  const dotClasses = {
    red: "bg-[#DC2626]",
    purple: "bg-[#7C3AED]",
    green: "bg-[#16A34A]"
  };

  return (
    <div className={surfaceStyles.section}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <h3 className={typographyStyles.h3}>{title}</h3>
      </div>
      <div className="grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <article key={item.title} className={`${surfaceStyles.subtle} px-3.5 py-3`}>
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClasses[tone]}`} />
                  <strong className="line-clamp-1 text-[13px] font-black text-[#211432]">{item.title}</strong>
                </div>
                {kind === "pain" ? (
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#7C6F95] ring-1 ring-[#E9D5FF]">{item.meta}</span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-xs leading-5 text-[#5F5472]">{truncateSentence(item.body, 120)}</p>
              <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-5 text-[#4C1D95]">→ {truncateSentence(item.footer, 120)}</p>
              {item.examples.length > 0 ? (
                <>
                  <button type="button" onClick={() => setOpenItem(openItem === item.title ? null : item.title)} className="mt-2 text-[11px] font-black text-[#7C3AED] transition hover:text-[#4C1D95]">
                    {openItem === item.title ? "Masquer les avis" : "Voir les avis concernés"}
                  </button>
                  {openItem === item.title ? (
                    <div className="mt-2 space-y-1.5 border-t border-[#E9D5FF] pt-2">
                      {item.examples.slice(0, 2).map((example) => (
                        <blockquote key={example} className="line-clamp-2 rounded-xl bg-white px-3 py-2 text-[11px] leading-5 text-[#7C6F95]">
                          {example}
                        </blockquote>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </article>
          ))
        ) : (
          <div className={`${surfaceStyles.empty} p-4 text-sm text-[#8B7AA8]`}>Aucun signal prioritaire détecté.</div>
        )}
      </div>
    </div>
  );
}

function ActionsColumn({
  title,
  icon,
  items
}: {
  title: string;
  icon: Parameters<typeof Icon>[0]["name"];
  items: { title: string; impact: string; difficulty: string }[];
}) {
  return (
    <div className={surfaceStyles.section}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#7C3AED]">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <h3 className={typographyStyles.h3}>{title}</h3>
      </div>
      <div className="grid gap-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <article key={item.title} className={`${surfaceStyles.subtle} grid grid-cols-[24px_1fr] gap-2 px-3.5 py-3`}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-[#7C3AED] ring-1 ring-[#E9D5FF]">{index + 1}</span>
              <div className="min-w-0">
                <strong className="line-clamp-1 text-[13px] font-black text-[#211432]">{item.title}</strong>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="rounded-full bg-white px-2 py-0.5 text-[#4C1D95] ring-1 ring-[#E9D5FF]">Impact : {item.impact}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[#7C6F95] ring-1 ring-[#E9D5FF]">Difficulté : {item.difficulty}</span>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className={`${surfaceStyles.empty} p-4 text-sm text-[#8B7AA8]`}>Aucune action prioritaire.</div>
        )}
      </div>
    </div>
  );
}

function truncateSentence(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
