"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Icon } from "@/components/icons";
import { Sidebar } from "@/components/Sidebar";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { Review } from "@/lib/mock-data";
import { getAppNotifications } from "@/lib/notifications";
import type { ReviewInsightsAnalysis } from "@/lib/review-insights";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import type { GoogleConnectionRow, MerchantRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";
import { appShellStyles } from "@/lib/design-system";

type QuickNavKey = "insights" | "pains" | "strengths" | "actions" | "automations";

export function InsightsPageClient({
  reviews,
  merchant,
  googleConnection,
  initialAnalysis,
  initialUpdatedAt,
  reviewAutomationSummary,
  socialAutomationSummary,
  reviewAutomationEnabled,
  socialAutomationEnabled,
  shouldAutoAnalyze
}: {
  reviews: Review[];
  merchant?: MerchantRow | null;
  googleConnection?: GoogleConnectionRow | null;
  initialAnalysis: ReviewInsightsAnalysis | null;
  initialUpdatedAt?: string | null;
  reviewAutomationSummary: string;
  socialAutomationSummary: string;
  reviewAutomationEnabled: boolean;
  socialAutomationEnabled: boolean;
  shouldAutoAnalyze: boolean;
}) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [loading, setLoading] = useState(false);
  const [silentLoading, setSilentLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalysisDate, setLastAnalysisDate] = useState(initialUpdatedAt ?? null);
  const [doneActions, setDoneActions] = useState<number[]>([]);
  const [openExamples, setOpenExamples] = useState<Record<string, boolean>>({});
  const [activeNav, setActiveNav] = useState<QuickNavKey>("insights");
  const autoStarted = useRef(false);
  const inFlightRef = useRef(false);
  const { toast, showToast } = useToast();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const hasReviews = reviews.length > 0;
  const hasAnalysis = Boolean(analysis);

  const sentiment = useMemo(() => {
    const positive = reviews.filter((review) => review.sentiment === "positif").length;
    const neutral = reviews.filter((review) => review.sentiment === "neutre").length;
    const negative = reviews.filter((review) => review.sentiment === "negatif").length;
    const total = reviews.length || 1;
    const positivePercent = Math.round((positive / total) * 100);
    const neutralPercent = Math.round((neutral / total) * 100);
    const negativePercent = Math.max(0, 100 - positivePercent - neutralPercent);
    return { positive, neutral, negative, positivePercent, neutralPercent, negativePercent };
  }, [reviews]);

  async function runAnalysis({ force = false, visible = true }: { force?: boolean; visible?: boolean } = {}) {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    if (visible) {
      setLoading(true);
      showToast(force ? "Hans relance l’analyse..." : "Hans analyse vos avis...", "saving");
    } else {
      setSilentLoading(true);
    }
    setAnalysisError(null);

    try {
      const response = await fetchWithTimeout("/api/reviews/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force })
      });
      const data = (await response.json()) as { analysis?: ReviewInsightsAnalysis; updated_at?: string; cached?: boolean; save_error?: string; error?: string };

      if (!response.ok || !data.analysis) {
        throw new Error(data.error ?? "Impossible d’analyser les avis pour le moment.");
      }

      setAnalysis(data.analysis);
      setLastAnalysisDate(data.updated_at ?? new Date().toISOString());
      if (visible) {
        showToast(
          data.save_error ? `Analyse générée mais non sauvegardée : ${data.save_error}` : data.cached ? "Analyse déjà à jour" : "Analyse IA sauvegardée",
          data.save_error ? "error" : "success"
        );
      }
    } catch (error) {
      const message = getUserErrorMessage(error, "Impossible d’analyser les avis pour le moment.");
      setAnalysisError(message);
      showToast(message, "error");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setSilentLoading(false);
    }
  }

  useEffect(() => {
    if (!hasReviews || !shouldAutoAnalyze || loading || silentLoading || autoStarted.current) return;
    autoStarted.current = true;
    void runAnalysis({ force: false, visible: !hasAnalysis });
  }, [hasAnalysis, hasReviews, loading, shouldAutoAnalyze, silentLoading]);

  useEffect(() => {
    const sections = ["insights", "pains", "strengths", "actions", "automations"]
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveNav(entry.target.id as QuickNavKey);
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [analysis, hasReviews]);

  const analysisView = analysis ?? { painPoints: [], strengths: [], priorityActions: [], socialPostIdeas: [] };

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="insights" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className={appShellStyles.width}>
            <div className="mx-auto max-w-[1180px] bg-[#F5F4FA] px-6 pb-20 pt-8">
              {!hasReviews ? (
                <section className="rounded-[20px] border border-[#ECE9F4] bg-white p-10 text-center shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1EAFB] text-[#5B2A9E]">
                    <Icon name="star" className="h-6 w-6" />
                  </div>
                  <h2 className="text-[22px] font-extrabold text-[#1E1B2E]">Aucun avis à analyser</h2>
                  <p className="mx-auto mt-2 max-w-xl text-[14px] leading-[1.55] text-[#6E6B80]">
                    Ajoutez ou importez des avis clients pour que Hans détecte les sujets récurrents et propose des actions marketing.
                  </p>
                </section>
              ) : (
                <>
                  <header className="mb-[22px] flex flex-wrap items-start justify-between gap-8 rounded-[20px] border border-[#ECE9F4] bg-white px-7 pb-6 pt-7 shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                    <div className="min-w-[280px] flex-1">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Hans a analysé vos avis</p>
                      <h1 className="mb-[10px] text-[26px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Ce que vos clients disent vraiment</h1>
                      <p className="mb-[14px] max-w-[520px] text-[14.5px] leading-[1.55] text-[#6E6B80]">
                        Hans repère ce qui rassure vos clients, ce qui freine encore certains achats, et ce que vous pouvez faire ensuite.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[#9895A8]">
                        <span>
                          Dernière analyse :{" "}
                          {lastAnalysisDate
                            ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastAnalysisDate))
                            : "Non disponible"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-[#9895A8]" />
                        <span>{reviews.length} avis passés au crible</span>
                        {silentLoading ? (
                          <>
                            <span className="h-1 w-1 rounded-full bg-[#9895A8]" />
                            <span>Hans vérifie les nouveaux avis…</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-[22px]">
                      <div className="flex items-center gap-[14px] rounded-[14px] border border-[#F1EEF8] bg-[#F8F5FC] px-4 py-3">
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-full"
                          style={{
                            background: `conic-gradient(#2E9E5B 0% ${sentiment.positivePercent}%, #DEDBE8 ${sentiment.positivePercent}% ${sentiment.positivePercent + sentiment.neutralPercent}%, #D64545 ${sentiment.positivePercent + sentiment.neutralPercent}% 100%)`
                          }}
                        >
                          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-white leading-none">
                            <b className="text-sm font-extrabold text-[#1E1B2E]">{sentiment.positivePercent}%</b>
                            <span className="text-[8px] font-semibold text-[#9895A8]">POSITIFS</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-[5px]">
                          <LegendRow color="#2E9E5B" label={`${sentiment.positivePercent}% positifs`} />
                          <LegendRow color="#DEDBE8" label={`${sentiment.neutralPercent}% neutres`} />
                          <LegendRow color="#D64545" label={`${sentiment.negativePercent}% négatifs`} />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => runAnalysis({ force: true, visible: true })}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[18px] py-[11px] text-[13.5px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)] transition hover:shadow-[0_8px_22px_rgba(75,46,131,0.36)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Icon name="refresh" className={`h-4 w-4 ${loading ? "[animation:spin-once_0.8s_linear_infinite]" : ""}`} />
                        {hasAnalysis ? "Relancer l’analyse" : "Lancer l’analyse"}
                      </button>
                    </div>
                  </header>

                  <nav className="mb-7 flex flex-wrap gap-2">
                    {[
                      ["insights", "Vue d'ensemble"],
                      ["pains", "Douleurs"],
                      ["strengths", "Points forts"],
                      ["actions", "Actions"],
                      ["automations", "Automatisations"]
                    ].map(([key, label]) => (
                      <a
                        key={key}
                        href={`#${key}`}
                        className={`rounded-full border px-[14px] py-2 text-[13px] font-semibold transition ${
                          activeNav === key ? "border-[#4B2E83] bg-[#4B2E83] text-white" : "border-[#ECE9F4] bg-white text-[#6E6B80] hover:border-[#7C4DCB] hover:text-[#4B2E83]"
                        }`}
                      >
                        {label}
                      </a>
                    ))}
                  </nav>

                  <section id="insights" className="mb-9 scroll-mt-5">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Hans a analysé vos avis</p>
                        <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Ce que vos clients disent vraiment</h2>
                      </div>
                      <a href="#automations" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5B2A9E] hover:underline">
                        Voir plus de détails
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                      </a>
                    </div>

                    {analysisError ? (
                      <div className="mb-4 rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">{analysisError}</div>
                    ) : null}

                    {loading && !hasAnalysis ? (
                      <section className="rounded-[20px] border border-[#ECE9F4] bg-white p-8 text-center shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1EAFB] text-[#5B2A9E]">
                          <Icon name="refresh" className="h-6 w-6 [animation:spin-once_0.8s_linear_infinite]" />
                        </div>
                        <h3 className="text-[20px] font-extrabold text-[#1E1B2E]">Hans analyse vos avis</h3>
                        <p className="mx-auto mt-2 max-w-xl text-[14px] leading-[1.55] text-[#6E6B80]">
                          Hans lit les avis, repère les douleurs clients récurrentes, les points forts et prépare vos prochaines actions.
                        </p>
                      </section>
                    ) : (
                      <div className="grid items-start gap-[18px] xl:grid-cols-3">
                        <InsightColumn
                          id="pains"
                          title="Douleurs principales"
                          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                          iconClass="bg-[#FBEAEA] text-[#D64545]"
                          dotClass="bg-[#D64545]"
                          items={analysisView.painPoints.map((item) => ({
                            key: `pain-${item.title}`,
                            title: item.title,
                            frequency: item.frequency,
                            text: item.summary,
                            recommendation: item.recommendation,
                            examples: item.examples
                          }))}
                          openExamples={openExamples}
                          onToggle={(key) => setOpenExamples((current) => ({ ...current, [key]: !current[key] }))}
                          kind="pain"
                        />

                        <InsightColumn
                          id="strengths"
                          title="Points forts à valoriser"
                          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 7.1-.7z"/></svg>}
                          iconClass="bg-[#F1EAFB] text-[#5B2A9E]"
                          dotClass="bg-[#2E9E5B]"
                          items={analysisView.strengths.map((item) => ({
                            key: `strength-${item.title}`,
                            title: item.title,
                            text: item.summary,
                            recommendation: item.communicationAngle,
                            examples: item.examples
                          }))}
                          openExamples={openExamples}
                          onToggle={(key) => setOpenExamples((current) => ({ ...current, [key]: !current[key] }))}
                          kind="strength"
                        />

                        <ActionsColumn
                          id="actions"
                          items={analysisView.priorityActions.slice(0, 3).map((item, index) => ({
                            id: index + 1,
                            title: item.title,
                            impact: item.impact,
                            difficulty: item.difficulty
                          }))}
                          doneActions={doneActions}
                          onToggle={(id) =>
                            setDoneActions((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
                          }
                        />
                      </div>
                    )}
                  </section>

                  <section id="automations" className="mb-9 scroll-mt-5">
                    <div className="mb-4">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Automatisations possibles</p>
                      <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Hans peut aussi agir pour vous</h2>
                    </div>

                    <div className="mb-4 rounded-[20px] border border-[#ECE9F4] bg-white shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                        {[
                          ["Un avis arrive", "message"],
                          ["Hans rédige un brouillon", "sparkle"],
                          ["Vous validez", "check"],
                          ["La réponse est publiée", "send"]
                        ].map(([label, icon], index, array) => (
                          <div key={label} className="flex min-w-[120px] flex-1 items-center justify-center gap-2">
                            <div className="flex flex-col items-center gap-2 text-center">
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F1EAFB] bg-[#F8F5FC] text-[#4B2E83]">
                                <Icon name={icon as Parameters<typeof Icon>[0]["name"]} className="h-4 w-4" />
                              </span>
                              <span className="max-w-[110px] text-xs font-semibold text-[#6E6B80]">{label}</span>
                            </div>
                            {index < array.length - 1 ? <div className="hidden h-0 flex-[0.6] border-t-2 border-dashed border-[#DEDBE8] md:block" /> : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-[18px] lg:grid-cols-2">
                      <AutomationCard
                        title="Avis Google"
                        active={reviewAutomationEnabled}
                        description={reviewAutomationSummary}
                        href="/automations"
                        ctaLabel="Configurer les avis"
                        icon="message"
                        activeLabel="Actif"
                        inactiveLabel="À activer"
                      />
                      <AutomationCard
                        title="Instagram"
                        active={socialAutomationEnabled}
                        description={socialAutomationSummary}
                        href="/social"
                        ctaLabel="Découvrir les recommandations de Hans"
                        icon="phone"
                        activeLabel="Actif"
                        inactiveLabel="À activer"
                      />
                    </div>
                  </section>

                  <div className="flex flex-wrap items-center justify-between gap-5 rounded-[20px] border border-dashed border-[#F1EAFB] bg-[#F8F5FC] px-6 py-[22px]">
                    <div className="flex max-w-[640px] items-start gap-[14px]">
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-white text-[#5B2A9E] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                        <Icon name="phone" className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="mb-1 text-[14.5px] font-bold text-[#1E1B2E]">Recommandations de posts</h4>
                        <p className="text-[12.8px] leading-[1.5] text-[#6E6B80]">
                          Elles vivent maintenant dans l&apos;espace Instagram, pour garder cette page centrée sur l&apos;analyse des avis et vos automatisations.
                        </p>
                      </div>
                    </div>
                    <Link href="/social" className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[18px] py-[11px] text-[13.5px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)] transition hover:shadow-[0_8px_22px_rgba(75,46,131,0.36)]">
                      Voir les recommandations
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
      <Toast toast={toast} />
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-[6px] text-xs text-[#6E6B80]">
      <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function InsightColumn({
  id,
  title,
  icon,
  iconClass,
  dotClass,
  items,
  openExamples,
  onToggle,
  kind
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconClass: string;
  dotClass: string;
  items: { key: string; title: string; frequency?: string; text: string; recommendation: string; examples: string[] }[];
  openExamples: Record<string, boolean>;
  onToggle: (key: string) => void;
  kind: "pain" | "strength";
}) {
  return (
    <div id={id} className="scroll-mt-5 rounded-[20px] border border-[#ECE9F4] bg-white shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
      <div className="flex items-center gap-[9px] px-[18px] pb-[10px] pt-4">
        <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] ${iconClass}`}>{icon}</div>
        <h3 className="text-[14.5px] font-bold text-[#1E1B2E]">{title}</h3>
      </div>
      <div className="flex flex-col gap-[10px] px-[14px] pb-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.key} className="rounded-[14px] border border-[#F1EEF8] bg-[#FDFCFE] px-[14px] py-[13px]">
              <div className="mb-[6px] flex items-start justify-between gap-2">
                <div className="flex items-center gap-[7px]">
                  <span className={`h-[7px] w-[7px] rounded-full ${dotClass}`} />
                  <span className="text-[13.5px] font-bold text-[#1E1B2E]">{item.title}</span>
                </div>
              </div>
              {kind === "pain" && item.frequency ? (
                <div className="my-2 flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] font-semibold text-[#9895A8]">Fréquence</span>
                  <div className="flex flex-1 gap-[3px]">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <span key={`${item.key}-meter-${index}`} className={`h-[5px] flex-1 rounded-[3px] ${index < frequencyToLevel(item.frequency ?? "faible") ? "bg-[#D64545]" : "bg-[#F2F1F6]"}`} />
                    ))}
                  </div>
                  <span className="inline-flex rounded-full bg-[#F2F1F6] px-[10px] py-1 text-[11.5px] font-semibold text-[#6E6B80]">{capitalize(item.frequency)}</span>
                </div>
              ) : null}
              <p className="mb-2 text-[12.8px] leading-[1.5] text-[#6E6B80]">{item.text}</p>
              <div className="mb-2 rounded-[10px] bg-[#F8F5FC] px-[10px] py-2 text-[12.5px] leading-[1.45] text-[#4B2E83]">
                <b>{kind === "pain" ? "À faire →" : "Opportunité →"}</b> {item.recommendation}
              </div>
              {item.examples.length > 0 ? (
                <>
                  <button type="button" onClick={() => onToggle(item.key)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#5B2A9E] hover:underline">
                    {openExamples[item.key] ? "Masquer les avis" : "Voir les avis concernés"}
                    <svg className={`transition-transform ${openExamples[item.key] ? "rotate-180" : ""}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  {openExamples[item.key] ? (
                    <div className="mt-[9px] flex flex-col gap-[6px] border-t border-dashed border-[#ECE9F4] pt-[9px]">
                      {item.examples.slice(0, 2).map((example) => (
                        <div key={example} className="rounded-[10px] border border-[#F1EEF8] bg-white px-[9px] py-[7px] text-xs leading-[1.4] text-[#6E6B80]">
                          {example}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-[14px] border border-[#F1EEF8] bg-[#FDFCFE] px-[14px] py-[13px] text-sm text-[#9895A8]">Aucun signal prioritaire détecté.</div>
        )}
      </div>
    </div>
  );
}

function ActionsColumn({
  id,
  items,
  doneActions,
  onToggle
}: {
  id: string;
  items: { id: number; title: string; impact: string; difficulty: string }[];
  doneActions: number[];
  onToggle: (id: number) => void;
}) {
  return (
    <div id={id} className="scroll-mt-5 rounded-[20px] border border-[#ECE9F4] bg-white shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
      <div className="flex items-center gap-[9px] px-[18px] pb-[10px] pt-4">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#F1EAFB] text-[#5B2A9E]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h3 className="text-[14.5px] font-bold text-[#1E1B2E]">Actions prioritaires</h3>
      </div>
      <div className="flex flex-col gap-[10px] px-[14px] pb-4">
        {items.length > 0 ? (
          items.map((item) => {
            const done = doneActions.includes(item.id);
            return (
              <div key={item.id} className="flex gap-[11px] rounded-[14px] border border-[#F1EEF8] bg-[#FDFCFE] px-[14px] py-3">
                <div className="shrink-0 pt-[1px]">
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition ${done ? "border-[#4B2E83] bg-[#4B2E83]" : "border-[#DEDBE8] bg-white"}`}
                  >
                    <svg className={`${done ? "opacity-100" : "opacity-0"} transition-opacity`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </button>
                </div>
                <div className="flex-1">
                  <div className={`mb-2 text-[13.5px] font-bold ${done ? "text-[#9895A8] line-through" : "text-[#1E1B2E]"}`}>{item.id} · {item.title}</div>
                  <div className="flex flex-col gap-[6px]">
                    <MeterRow label="Impact" value={item.impact} tone="purple" />
                    <MeterRow label="Difficulté" value={item.difficulty} tone="green" />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[14px] border border-[#F1EEF8] bg-[#FDFCFE] px-[14px] py-[13px] text-sm text-[#9895A8]">Aucune action prioritaire pour le moment.</div>
        )}
        <div className="mt-1 flex items-center gap-[6px] text-[11.5px] text-[#9895A8]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>{doneActions.length} sur {items.length} actions traitées</span>
        </div>
      </div>
    </div>
  );
}

function MeterRow({ label, value, tone }: { label: string; value: string; tone: "purple" | "green" }) {
  const level = levelToNumber(value);
  const activeClass = tone === "green" ? "bg-[#2E9E5B]" : "bg-[#7C4DCB]";

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-semibold text-[#9895A8]">{label}</span>
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 3 }).map((_, index) => (
          <span key={`${label}-${value}-${index}`} className={`h-[5px] flex-1 rounded-[3px] ${index < level ? activeClass : "bg-[#F2F1F6]"}`} />
        ))}
      </div>
      <span className={`inline-flex rounded-full px-[10px] py-1 text-[11.5px] font-semibold ${tone === "green" ? "bg-[#F2F1F6] text-[#6E6B80]" : "bg-[#F1EAFB] text-[#4B2E83]"}`}>
        {capitalize(value)}
      </span>
    </div>
  );
}

function AutomationCard({
  title,
  active,
  description,
  href,
  ctaLabel,
  icon,
  activeLabel,
  inactiveLabel
}: {
  title: string;
  active: boolean;
  description: string;
  href: string;
  ctaLabel: string;
  icon: Parameters<typeof Icon>[0]["name"];
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#ECE9F4] bg-white px-5 py-[18px] shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] ${active ? "bg-[#F1EAFB] text-[#5B2A9E]" : "bg-[#F2F1F6] text-[#6E6B80]"}`}>
            <Icon name={icon} className="h-4 w-4" />
          </div>
          <h4 className="text-[14.5px] font-bold text-[#1E1B2E]">{title}</h4>
        </div>
        <span className={`relative h-[23px] w-10 rounded-full ${active ? "bg-[#2E9E5B]" : "bg-[#DEDBE8]"}`}>
          <span className={`absolute top-[2.5px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition ${active ? "left-[19.5px]" : "left-[2.5px]"}`} />
        </span>
      </div>
      <div className={`mb-2 inline-flex items-center gap-[5px] text-[11.5px] font-bold ${active ? "text-[#2E9E5B]" : "text-[#9895A8]"}`}>
        <span className="h-[6px] w-[6px] rounded-full bg-current" />
        {active ? activeLabel : inactiveLabel}
      </div>
      <p className="mb-[14px] text-[12.8px] leading-[1.5] text-[#6E6B80]">{description}</p>
      <Link href={href} className="inline-flex items-center rounded-full border border-[#ECE9F4] bg-white px-4 py-[10px] text-[13.5px] font-semibold text-[#4B2E83] transition hover:border-[#7C4DCB]">
        {ctaLabel}
      </Link>
    </div>
  );
}

function frequencyToLevel(value: string) {
  if (value === "élevée") return 3;
  if (value === "moyenne") return 2;
  return 1;
}

function levelToNumber(value: string) {
  if (value === "élevé" || value === "difficile") return 3;
  if (value === "moyen" || value === "moyenne") return 2;
  return 1;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
