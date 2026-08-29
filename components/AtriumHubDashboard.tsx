"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";
import { Sidebar } from "@/components/Sidebar";
import { appShellStyles, badgeStyles, buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import type { Review } from "@/lib/mock-data";
import { getDynamicHansRecommendations } from "@/lib/hans-dynamic-recommendations";
import { getAppNotifications } from "@/lib/notifications";
import type { ReviewInsightsAnalysis } from "@/lib/review-insights";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import type { GoogleConnectionRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export function AtriumHubDashboard({
  reviews,
  merchant,
  googleConnection,
  instagramConnected = false,
  insights,
  insightsUpdatedAt,
  socialPosts = []
}: {
  reviews: Review[];
  merchant?: MerchantRow | null;
  googleConnection?: GoogleConnectionRow | null;
  instagramConnected?: boolean;
  insights?: ReviewInsightsAnalysis | null;
  insightsUpdatedAt?: string | null;
  socialPosts?: SocialPostRow[];
  shouldAutoAnalyze?: boolean;
}) {
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const businessName = merchant?.business_name ?? "votre commerce";
  const googleConnected = googleConnection?.status === "connected";
  const analysis = insights ?? null;
  const postsRecommended = analysis?.socialPostIdeas.slice(0, 3) ?? [];
  const activeDrafts = socialPosts.filter((post) => ["draft", "editing", "saved", "ready"].includes(post.status));
  const publishedPosts = socialPosts.filter((post) => post.status === "published");
  const hansRecommendations = buildDashboardRecommendations({
    reviews,
    googleConnected,
    instagramConnected,
    postsRecommendedCount: postsRecommended.length,
    draftsCount: activeDrafts.length,
    analysis,
    publishedPostsCount: publishedPosts.length
  }).slice(0, 3);
  const progressSteps = buildProgressSteps({
    reviewsCount: reviews.length,
    analysis,
    draftsCount: activeDrafts.length,
    googleConnected
  });
  const activityItems = buildActivityItems({
    reviews,
    analysis,
    activeDrafts,
    publishedPostsCount: publishedPosts.length,
    insightsUpdatedAt
  }).slice(0, 5);
  const summaryCards = [
    {
      title: "Avis collectés",
      value: `${reviews.length}`,
      description: reviews.length > 0 ? `${reviews.length} avis déjà remontés dans AtriumOne.` : "Connectez Google pour commencer à recevoir vos avis.",
      ctaLabel: googleConnected ? "Voir mes avis" : "Connecter Google",
      href: googleConnected ? "/reviews" : "/settings",
      icon: "star" as const
    },
    {
      title: "Avis à traiter",
      value: `${counters.pending}`,
      description: counters.pending > 0 ? `${counters.pending} avis attendent une action de votre part ou de Hans.` : "Aucun avis urgent pour le moment. Hans garde un œil dessus.",
      ctaLabel: counters.pending > 0 ? "Traiter maintenant" : "Voir mes avis",
      href: "/reviews",
      icon: "message" as const
    },
    {
      title: "Posts recommandés par Hans",
      value: `${postsRecommended.length}`,
      description: postsRecommended.length > 0 ? "Découvrez les recommandations de Hans pour vos prochains posts dans Instagram." : "Les prochaines idées seront préparées automatiquement lors de l’analyse quotidienne de 8 h.",
      ctaLabel: "Découvrir les recommandations",
      href: "/social",
      icon: "sparkle" as const
    },
    {
      title: "Brouillons en cours",
      value: `${activeDrafts.length}`,
      description: activeDrafts.length > 0 ? `${activeDrafts.length} contenu${activeDrafts.length > 1 ? "s sont" : " est"} en attente de reprise ou de publication.` : "Créez votre premier post pour démarrer votre présence sociale.",
      ctaLabel: activeDrafts.length > 0 ? "Reprendre mes brouillons" : "Créer un post",
      href: "/social",
      icon: "document" as const
    }
  ];

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="dashboard" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className={appShellStyles.width}>
          <section className={`${surfaceStyles.hero} md:p-6`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className={`${typographyStyles.kicker} mb-2`}>Vue d’ensemble</p>
                <h1 className={`${typographyStyles.h1} text-2xl md:text-3xl`}>
                  Bonjour, {businessName}
                </h1>
                <p className={`${typographyStyles.body} mt-2`}>
                  Hans a identifié {hansRecommendations.length} action{hansRecommendations.length > 1 ? "s" : ""} prioritaire{hansRecommendations.length > 1 ? "s" : ""} aujourd’hui.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/reviews" className={buttonStyles.primary}>
                    Voir mes avis
                  </Link>
                  <Link href="/reviews/insights" className={buttonStyles.tertiary}>
                    Voir mes recommandations
                  </Link>
                </div>
              </div>
              <div className={`${surfaceStyles.subtle} flex items-center gap-4 px-4 py-4 lg:min-w-[280px]`}>
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--color-primary-soft)]">
                  <HansAvatar size={52} />
                </div>
                <div>
                  <div className={typographyStyles.h3}>Hans vous accompagne</div>
                  <div className={`${typographyStyles.caption} mt-1 text-xs leading-5`}>
                    {hansRecommendations[0]?.description ?? "Tout est calme pour le moment. Vous pouvez avancer sur vos prochains contenus."}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <article key={card.title} className={surfaceStyles.kpi}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className={surfaceStyles.icon}>
                    <Icon name={card.icon} className="h-5 w-5" />
                  </span>
                  <span className={badgeStyles.neutral}>Vue d’ensemble</span>
                </div>
                <div className={typographyStyles.kicker}>{card.title}</div>
                <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--color-text)]">{card.value}</div>
                <p className={`${typographyStyles.body} mt-2 min-h-[72px]`}>{card.description}</p>
                <Link href={card.href} className={`mt-4 ${buttonStyles.secondary}`}>
                  {card.ctaLabel}
                </Link>
              </article>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className={`${surfaceStyles.hans} md:p-6`}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)]">
                  <HansAvatar size={40} />
                </div>
                <div>
                  <div className={`${badgeStyles.hans} mb-2`}>Hans</div>
                  <h2 className={typographyStyles.h2}>Ce que Hans recommande aujourd’hui</h2>
                  <p className={`${typographyStyles.body} mt-1`}>Des prochaines étapes simples, claires et utiles pour votre commerce.</p>
                </div>
              </div>
              <div className="space-y-3">
                {hansRecommendations.map((recommendation) => (
                  <article key={recommendation.id} className={`${surfaceStyles.hansItem} p-3.5`}>
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`${recommendation.priority === "Haute" ? badgeStyles.danger : recommendation.priority === "Moyenne" ? badgeStyles.warning : badgeStyles.hans}`}>
                            Priorité {recommendation.priority.toLowerCase()}
                          </span>
                        </div>
                        <h3 className={typographyStyles.h3}>{recommendation.title}</h3>
                        <p className={`${typographyStyles.body} mt-2`}>{recommendation.description}</p>
                      </div>
                      <div className="flex items-start lg:justify-end">
                        <Link href={recommendation.href} className={`w-fit shrink-0 ${buttonStyles.primary}`}>
                          {recommendation.ctaLabel}
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <section className={surfaceStyles.section}>
                <div className="mb-4">
                  <h2 className={typographyStyles.h2}>Parcours AtriumOne</h2>
                  <p className={`${typographyStyles.body} mt-1`}>Comprenez en un coup d’œil où vous en êtes.</p>
                </div>
                <div className="space-y-3">
                  {progressSteps.map((step, index) => (
                    <div key={step.title} className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${step.state === "done" ? "bg-[var(--color-primary)] text-white" : step.state === "in_progress" ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" : "bg-[var(--color-secondary)] text-[var(--color-text-soft)]"}`}>
                          {index + 1}
                        </span>
                        {index < progressSteps.length - 1 ? <span className="mt-1 h-8 w-px bg-[#E8E4DB]" /> : null}
                      </div>
                      <div className={`flex-1 ${surfaceStyles.subtle} px-4 py-3`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-[var(--color-text)]">{step.title}</strong>
                          <span className={`${step.state === "done" ? badgeStyles.hans : step.state === "in_progress" ? badgeStyles.warning : badgeStyles.neutral}`}>
                            {step.label}
                          </span>
                        </div>
                        <p className={`${typographyStyles.caption} mt-1 text-xs leading-5`}>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={surfaceStyles.section}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className={typographyStyles.h2}>Activité récente</h2>
                    <p className={`${typographyStyles.body} mt-1`}>Les derniers événements utiles à suivre dans AtriumOne.</p>
                  </div>
                  <Icon name="chart" className="h-5 w-5 text-[var(--color-text-soft)]" />
                </div>
                <div className="space-y-3">
                  {activityItems.map((item) => (
                    <article key={item.id} className={`${surfaceStyles.subtle} px-4 py-3`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-[var(--color-text)]">{item.title}</div>
                          <div className={`${typographyStyles.caption} mt-1 text-xs leading-5`}>{item.description}</div>
                        </div>
                        <span className={`${typographyStyles.caption} shrink-0 text-[11px] font-semibold`}>{item.label}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          </section>

          <section className={`${surfaceStyles.section} md:p-6`}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className={typographyStyles.h2}>Posts recommandés par Hans</h2>
                <p className={`${typographyStyles.body} mt-1`}>Retrouvez les idées de contenus de Hans directement dans l’espace Instagram.</p>
              </div>
              <Link href="/social" className={`w-fit ${buttonStyles.primary}`}>
                Voir Instagram
              </Link>
            </div>
            <div className={`${surfaceStyles.subtle} p-6`}>
              <div className={typographyStyles.h3}>Découvrir les recommandations de Hans pour les posts</div>
              <p className={`${typographyStyles.body} mt-2 max-w-2xl`}>
                Les recommandations de posts sont centralisées dans l’espace Instagram pour garder le dashboard plus lisible.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/social" className={buttonStyles.primary}>
                  Ouvrir Instagram
                </Link>
                <Link href="/reviews/insights" className={buttonStyles.tertiary}>
                  Voir l’analyse IA
                </Link>
              </div>
            </div>
          </section>
          </div>
        </main>
      </div>
    </div>
  );
}

type DashboardRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: "Haute" | "Moyenne" | "Basse";
  ctaLabel: string;
  href: string;
};

function buildDashboardRecommendations({
  reviews,
  googleConnected,
  instagramConnected,
  postsRecommendedCount,
  draftsCount,
  analysis,
  publishedPostsCount
}: {
  reviews: Review[];
  googleConnected: boolean;
  instagramConnected: boolean;
  postsRecommendedCount: number;
  draftsCount: number;
  analysis: ReviewInsightsAnalysis | null;
  publishedPostsCount: number;
}): DashboardRecommendation[] {
  const baseTasks = getDynamicHansRecommendations(reviews, googleConnected);
  const recommendations: DashboardRecommendation[] = baseTasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.state === "todo" ? "Haute" : task.state === "in_progress" ? "Moyenne" : "Basse",
    ctaLabel: getDashboardTaskAction(task.id).label,
    href: getDashboardTaskAction(task.id).href
  }));

  if (!googleConnected) {
    recommendations.unshift({
      id: "connect-google",
      title: "Connecter votre fiche Google",
      description: "Reliez Google Business pour importer vos avis automatiquement dans AtriumOne.",
      priority: "Haute",
      ctaLabel: "Connecter Google",
      href: "/social?connect=instagram"
    });
  }

  if (!instagramConnected) {
    recommendations.unshift({
      id: "connect-instagram",
      title: "Connecter Instagram",
      description: "Reliez Instagram pour publier les prochains posts recommandés par Hans.",
      priority: "Haute",
      ctaLabel: "Connecter Instagram",
      href: "/integrations"
    });
  }

  if (reviews.length >= 5 && postsRecommendedCount === 0) {
    recommendations.push({
      id: "run-hans-analysis",
      title: "Lancer une nouvelle analyse Hans",
      description: "Hans peut transformer vos avis en idées de contenu dès qu’une analyse récente est disponible.",
      priority: "Moyenne",
      ctaLabel: "Voir mes recommandations",
      href: "/reviews/insights"
    });
  }

  if (postsRecommendedCount > 0) {
    recommendations.push({
      id: "create-social-post",
      title: "Découvrir les recommandations Instagram",
      description: `${postsRecommendedCount} idée${postsRecommendedCount > 1 ? "s sont" : " est"} disponible${postsRecommendedCount > 1 ? "s" : ""} dans l’espace Instagram.`,
      priority: "Moyenne",
      ctaLabel: "Ouvrir Instagram",
      href: "/social"
    });
  }

  if (draftsCount > 0) {
    recommendations.push({
      id: "resume-drafts",
      title: "Reprendre vos brouillons",
      description: `${draftsCount} brouillon${draftsCount > 1 ? "s attendent" : " attend"} une dernière relecture ou une publication.`,
      priority: "Moyenne",
      ctaLabel: "Voir mes brouillons",
      href: "/social"
    });
  }

  if (analysis?.painPoints[0]) {
    recommendations.push({
      id: "improve-weak-point",
      title: `Améliorer : ${analysis.painPoints[0].title}`,
      description: analysis.painPoints[0].recommendation,
      priority: "Basse",
      ctaLabel: "Voir l’analyse",
      href: "/reviews/insights"
    });
  }

  if (publishedPostsCount > 0) {
    recommendations.push({
      id: "publish-content",
      title: "Capitaliser sur vos contenus publiés",
      description: `${publishedPostsCount} publication${publishedPostsCount > 1 ? "s ont" : " a"} déjà été finalisée${publishedPostsCount > 1 ? "s" : ""}. Relancez Hans pour préparer la suite.`,
      priority: "Basse",
      ctaLabel: "Voir Instagram",
      href: "/social"
    });
  }

  const unique = new Map<string, DashboardRecommendation>();
  recommendations.forEach((recommendation) => {
    if (!unique.has(recommendation.id)) {
      unique.set(recommendation.id, recommendation);
    }
  });

  return [...unique.values()];
}

function getDashboardTaskAction(taskId: string) {
  if (taskId.startsWith("urgent-") || taskId === "generate-missing-replies" || taskId === "approve-generated-replies") {
    return { label: "Voir mes avis", href: "/reviews" };
  }

  if (taskId === "connect-google-business") {
    return { label: "Ouvrir les intégrations", href: "/integrations" };
  }

  if (taskId === "improve-average-rating") {
    return { label: "Voir l’analyse", href: "/reviews/insights" };
  }

  return { label: "Ouvrir AtriumOne", href: "/dashboard" };
}

function buildProgressSteps({
  reviewsCount,
  analysis,
  draftsCount,
  googleConnected
}: {
  reviewsCount: number;
  analysis: ReviewInsightsAnalysis | null;
  draftsCount: number;
  googleConnected: boolean;
}) {
  return [
    {
      title: "Avis",
      state: reviewsCount > 0 ? "done" : googleConnected ? "in_progress" : "todo",
      label: reviewsCount > 0 ? "Terminé" : googleConnected ? "En cours" : "À faire",
      description: reviewsCount > 0 ? `${reviewsCount} avis disponibles dans AtriumOne.` : googleConnected ? "Google est connecté, les premiers avis peuvent arriver." : "Connectez Google pour commencer à recevoir des avis."
    },
    {
      title: "Analyse IA",
      state: analysis && (analysis.painPoints.length > 0 || analysis.strengths.length > 0 || analysis.priorityActions.length > 0) ? "done" : reviewsCount >= 5 ? "in_progress" : "todo",
      label: analysis && (analysis.painPoints.length > 0 || analysis.strengths.length > 0 || analysis.priorityActions.length > 0) ? "Terminé" : reviewsCount >= 5 ? "En cours" : "À faire",
      description: analysis && (analysis.painPoints.length > 0 || analysis.strengths.length > 0 || analysis.priorityActions.length > 0) ? "Hans a déjà identifié vos principaux leviers." : reviewsCount >= 5 ? "Hans peut analyser vos avis pour faire émerger des recommandations." : "Ajoutez au moins quelques avis pour lancer une analyse utile."
    },
    {
      title: "Réseaux sociaux",
      state: draftsCount > 0 ? "in_progress" : analysis?.socialPostIdeas.length ? "done" : "todo",
      label: draftsCount > 0 ? "En cours" : analysis?.socialPostIdeas.length ? "Terminé" : "À faire",
      description: draftsCount > 0 ? `${draftsCount} brouillon${draftsCount > 1 ? "s sont" : " est"} en préparation.` : analysis?.socialPostIdeas.length ? "Des idées de posts sont prêtes à être créées." : "Les idées de posts apparaîtront ici une fois l’analyse Hans disponible."
    }
  ] as const;
}

function buildActivityItems({
  reviews,
  analysis,
  activeDrafts,
  publishedPostsCount,
  insightsUpdatedAt
}: {
  reviews: Review[];
  analysis: ReviewInsightsAnalysis | null;
  activeDrafts: SocialPostRow[];
  publishedPostsCount: number;
  insightsUpdatedAt?: string | null;
}) {
  const counters = getReviewCountersFromReviews(reviews);
  const items: Array<{ id: string; title: string; description: string; label: string }> = [];

  if (reviews.length > 0) {
    items.push({
      id: "reviews-imported",
      title: `${reviews.length} avis importés`,
      description: "Votre base de retours clients est bien disponible dans AtriumOne.",
      label: "Aujourd’hui"
    });
  }

  if (insightsUpdatedAt && analysis && (analysis.priorityActions.length > 0 || analysis.socialPostIdeas.length > 0)) {
    items.push({
      id: "analysis-finished",
      title: "Analyse Hans terminée",
      description: `${analysis.priorityActions.length} action${analysis.priorityActions.length > 1 ? "s" : ""} et ${analysis.socialPostIdeas.length} idée${analysis.socialPostIdeas.length > 1 ? "s" : ""} de post disponibles.`,
      label: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(insightsUpdatedAt))
    });
  }

  if (activeDrafts.length > 0) {
    items.push({
      id: "draft-created",
      title: "Brouillon créé",
      description: `${activeDrafts.length} contenu${activeDrafts.length > 1 ? "s" : ""} attend${activeDrafts.length > 1 ? "ent" : ""} encore une validation.`,
      label: "En cours"
    });
  }

  if (publishedPostsCount > 0) {
    items.push({
      id: "post-exported",
      title: "Post finalisé",
      description: `${publishedPostsCount} publication${publishedPostsCount > 1 ? "s ont" : " a"} déjà été exportée${publishedPostsCount > 1 ? "s" : ""}.`,
      label: "Récent"
    });
  }

  if (counters.pending > 0) {
    items.push({
      id: "reviews-pending",
      title: "Avis à traiter",
      description: `${counters.pending} avis demandent encore une réponse ou une validation.`,
      label: "Prioritaire"
    });
  }

  if (items.length === 0) {
    items.push({
      id: "welcome",
      title: "AtriumOne est prêt",
      description: "Connectez Google, importez vos premiers avis puis laissez Hans vous guider.",
      label: "Départ"
    });
  }

  return items;
}
