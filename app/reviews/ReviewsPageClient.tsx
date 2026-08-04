"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminReviewForm } from "@/components/AdminReviewForm";
import { BulkReplyModal, type BulkReplyProgress } from "@/components/BulkReplyModal";
import { DevResetReviewsButton } from "@/components/DevResetReviewsButton";
import { HansFloatingChat } from "@/components/HansFloatingChat";
import { Header } from "@/components/Header";
import { Icon } from "@/components/icons";
import { Sidebar } from "@/components/Sidebar";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { appShellStyles } from "@/lib/design-system";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getHansScore } from "@/lib/hans-score";
import { type Review } from "@/lib/mock-data";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { getAutomationSummary } from "@/lib/review-automation";
import { getDynamicHansRecommendations } from "@/lib/hans-dynamic-recommendations";
import { isUrgentReview } from "@/lib/review-status";
import type { GoogleConnectionRow, MerchantAutomationSettingsRow, MerchantRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";

type FilterValue = "all" | "pending" | "negative" | "ready" | "published";

type HansRecommendation = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  href?: string;
  onClick?: () => void;
  priority: "Haute" | "Moyenne" | "Info";
};

function normalizeStatus(status: Review["status"] | string | null | undefined) {
  return status === "a-traiter" ? "a_traiter" : status ?? "a_traiter";
}

function getDisplayDate(value: string | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short"
  }).format(parsed);
}

function getGraphVisibility(reviews: Review[]) {
  const validDates = reviews
    .map((review) => review.createdAt)
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()));

  const distinctMonths = new Set(validDates.map((date) => `${date.getFullYear()}-${date.getMonth()}`));

  return reviews.length >= 4 && distinctMonths.size >= 2;
}

function isPendingReview(review: Review) {
  return ["urgent", "a_traiter", "a-traiter", "generated", "ready_to_publish", "validation_required", "blocked_by_safety"].includes(normalizeStatus(review.status));
}

function getReviewSortValue(review: Review) {
  if (normalizeStatus(review.status) === "urgent" || isUrgentReview(review)) {
    return 0;
  }

  if (normalizeStatus(review.status) === "a_traiter") {
    return 1;
  }

  if (normalizeStatus(review.status) === "generated") {
    return 2;
  }

  if (normalizeStatus(review.status) === "validation_required" || normalizeStatus(review.status) === "blocked_by_safety") {
    return 3;
  }

  if (normalizeStatus(review.status) === "ready_to_publish") {
    return 4;
  }

  if (["published", "repondu", "published_auto", "published_manual"].includes(normalizeStatus(review.status))) {
    return 5;
  }

  if (normalizeStatus(review.status) === "ignored") {
    return 4;
  }

  return 6;
}

export function ReviewsPageClient({
  reviews,
  merchant,
  googleConnection,
  automationSettings
}: {
  reviews: Review[];
  merchant?: MerchantRow | null;
  googleConnection?: GoogleConnectionRow | null;
  automationSettings?: MerchantAutomationSettingsRow | null;
}) {
  const searchParams = useSearchParams();
  const businessName = merchant?.business_name ?? "Maison Lavigne";
  const businessType = merchant?.business_type ?? "commerce";
  const googleConnected = googleConnection?.status === "connected";
  const [localReviews, setLocalReviews] = useState(reviews);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<string | null>(null);
  const [replyDraftId, setReplyDraftId] = useState<string | null>(null);
  const [replyStatus, setReplyStatus] = useState<string | null>(null);
  const [replyEdited, setReplyEdited] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [loadingReviewId, setLoadingReviewId] = useState<string | null>(null);
  const [publishingReviewId, setPublishingReviewId] = useState<string | null>(null);
  const [savingEditReviewId, setSavingEditReviewId] = useState<string | null>(null);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(automationSettings?.reviews_auto_reply_enabled ?? false);
  const [autoReplySaving, setAutoReplySaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkReplyProgress>({ total: 0, done: 0, errors: [], running: false });
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const autoProcessStarted = useRef<Set<string>>(new Set());
  const { toast, showToast } = useToast();

  const selectedReview = useMemo(
    () => localReviews.find((review) => review.id === selectedReviewId),
    [localReviews, selectedReviewId]
  );

  const counters = getReviewCountersFromReviews(localReviews);
  const notifications = getAppNotifications(localReviews, googleConnection);
  const hansScore = getHansScore(localReviews);
  const queryFilter = searchParams.get("filter");
  const activeFilter: FilterValue =
    queryFilter === "negative" || queryFilter === "pending" || queryFilter === "ready" || queryFilter === "published"
      ? queryFilter
      : queryFilter === "urgent"
        ? "negative"
        : "all";
  const baseRecommendations = getDynamicHansRecommendations(localReviews, googleConnected);
  const automationSummary = getAutomationSummary(automationSettings);

  const sortedReviews = useMemo(
    () =>
      [...localReviews].sort((first, second) => {
        const priorityDelta = getReviewSortValue(first) - getReviewSortValue(second);

        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return new Date(second.createdAt ?? 0).getTime() - new Date(first.createdAt ?? 0).getTime();
      }),
    [localReviews]
  );

  const filteredReviews = useMemo(() => {
    return sortedReviews.filter((review) => {
      const matchesSearch =
        search.length === 0 ||
        review.author.toLowerCase().includes(search.toLowerCase()) ||
        review.text.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) {
        return false;
      }

      if (activeFilter === "negative") {
        return isUrgentReview(review);
      }

      if (activeFilter === "pending") {
        return isPendingReview(review);
      }

      if (activeFilter === "ready") {
        return ["generated", "validation_required", "blocked_by_safety", "ready_to_publish"].includes(normalizeStatus(review.status));
      }

      if (activeFilter === "published") {
        return ["published", "repondu", "published_auto", "published_manual"].includes(normalizeStatus(review.status));
      }

      return true;
    });
  }, [activeFilter, search, sortedReviews]);

  const reviewsWithoutReply = useMemo(
    () =>
      sortedReviews.filter((review) =>
        ["urgent", "a_traiter", "a-traiter"].includes(normalizeStatus(review.status)) &&
        !review.generatedReply &&
        !review.generatedReplyId
      ),
    [sortedReviews]
  );

  const recommendations = useMemo<HansRecommendation[]>(() => {
    const items: HansRecommendation[] = [];

    if (!googleConnected) {
      items.push({
        id: "connect-google",
        title: "Connecter Google Business",
        description: "Connectez votre fiche pour importer les avis automatiquement et publier les réponses de Hans.",
        actionLabel: "Connecter Google",
        href: "/integrations",
        priority: "Haute"
      });
    }

    baseRecommendations.slice(0, 3).forEach((recommendation) => {
      if (recommendation.id.startsWith("urgent-")) {
        const reviewId = recommendation.id.replace("urgent-", "");
        items.push({
          id: recommendation.id,
          title: "Répondre à un avis prioritaire",
          description: recommendation.description,
          actionLabel: "Voir l’avis",
          onClick: () => {
            setSelectedReviewId(reviewId);
            setChatOpen(true);
          },
          priority: "Haute"
        });
        return;
      }

      if (recommendation.id === "generate-missing-replies") {
        items.push({
          id: recommendation.id,
          title: "Répondre plus vite aux avis en attente",
          description: recommendation.description,
          actionLabel: "Lancer Hans",
          onClick: () => {
            void processReviewsInBulk(reviewsWithoutReply.slice(0, 10));
          },
          priority: "Moyenne"
        });
        return;
      }

      if (recommendation.id === "approve-generated-replies") {
        items.push({
          id: recommendation.id,
          title: "Relire les réponses prêtes",
          description: recommendation.description,
          actionLabel: "Voir les avis",
          href: "/reviews?filter=ready",
          priority: "Moyenne"
        });
        return;
      }

      items.push({
        id: recommendation.id,
        title: recommendation.title,
        description: recommendation.description,
        actionLabel: recommendation.id === "all-clear" ? "Voir le dashboard" : "Ouvrir",
        href: recommendation.id === "all-clear" ? "/dashboard" : "/reviews",
        priority: recommendation.state === "done" ? "Info" : "Moyenne"
      });
    });

    if (items.length < 3 && hansScore.improvements[0]) {
      items.push({
        id: "improvement-focus",
        title: `Surveiller “${hansScore.improvements[0]}”`,
        description: "Hans voit ce sujet revenir dans les avis moins satisfaits. Une réponse claire aide à rassurer vos prochains clients.",
        actionLabel: "Voir les avis",
        href: "/reviews?filter=negative",
        priority: "Moyenne"
      });
    }

    return items.slice(0, 3);
  }, [baseRecommendations, googleConnected, hansScore.improvements, reviewsWithoutReply]);

  function updateReview(reviewId: string, updater: (review: Review) => Review) {
    setLocalReviews((current) => current.map((review) => (review.id === reviewId ? updater(review) : review)));
  }

  function addCreatedReview(review: Review) {
    setLocalReviews((current) => [review, ...current]);
  }

  function openReviewInHans(review: Review) {
    setSelectedReviewId(review.id);
    setReplyDraft(review.generatedReply ?? null);
    setReplyDraftId(review.generatedReplyId ?? null);
    setReplyStatus(review.generatedReplyStatus ?? null);
    setReplyEdited(Boolean(review.isReplyEdited));
    setChatOpen(true);
  }

  function shouldAutoProcessReview(review: Review) {
    return autoReplyEnabled && ["urgent", "a_traiter", "a-traiter"].includes(normalizeStatus(review.status)) && !review.generatedReply && !review.generatedReplyId;
  }

  async function requestHansReply(review: Review) {
    const response = await fetchWithTimeout("/api/hans/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        review_id: review.id,
        review_text: review.text,
        rating: review.rating,
        author_name: review.author,
        merchant_name: merchant?.business_name ?? businessName,
        business_type: merchant?.business_type ?? businessType,
        response_tone: merchant?.response_tone ?? "chaleureux"
      })
    });

    const data = (await response.json()) as {
      reply_text?: string;
      reply_id?: string;
      reply_status?: string;
      review_status?: string;
      error?: string;
      save_error?: string;
    };

    if (!response.ok || !data.reply_text) {
      throw new Error(data.error ?? "Impossible de générer la réponse.");
    }

    return data;
  }

  async function requestReplyValidation(review: Review, payload?: { replyId?: string | null; replyText?: string | null }) {
    const response = await fetchWithTimeout("/api/hans/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        review_id: review.id,
        reply_id: payload?.replyId ?? review.generatedReplyId,
        reply_text: payload?.replyText ?? review.generatedReply
      })
    });

    const data = (await response.json()) as {
      ok?: boolean;
      reply_id?: string;
      review_status?: string;
      reply_status?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Impossible de publier la réponse.");
    }

    return data;
  }

  async function requestReplyPublish(review: Review, payload?: { replyId?: string | null; replyText?: string | null; mode?: "manual" | "automatic" }) {
    const response = await fetchWithTimeout("/api/hans/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        review_id: review.id,
        reply_id: payload?.replyId ?? review.generatedReplyId,
        reply_text: payload?.replyText ?? review.generatedReply,
        mode: payload?.mode ?? "manual"
      })
    });

    const data = (await response.json()) as {
      ok?: boolean;
      review_status?: string;
      reply_status?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Impossible de publier la réponse.");
    }

    return data;
  }

  async function processReviewAutomatically(review: Review) {
    const generated = await requestHansReply(review);
    updateReview(review.id, (current) => ({
      ...current,
      generatedReply: generated.reply_text,
      generatedText: generated.reply_text,
      generatedReplyId: generated.reply_id,
      generatedReplyStatus: (generated.reply_status as Review["generatedReplyStatus"]) ?? "generated",
      status: (generated.review_status as Review["status"]) ?? "generated",
      isReplyEdited: false
    }));
  }

  async function processReviewsInBulk(targetReviews: Review[]) {
    if (targetReviews.length === 0) {
      showToast("Aucun avis à traiter pour le moment.", "success");
      return;
    }

    setBulkProgress({ total: targetReviews.length, done: 0, errors: [], running: true });
    setBulkModalOpen(true);

    const errors: string[] = [];
    let done = 0;

    for (const review of targetReviews) {
      try {
        await processReviewAutomatically(review);
        done += 1;
        setBulkProgress({ total: targetReviews.length, done, errors: [...errors], running: true });
      } catch (error) {
        errors.push(`${review.author} · ${getUserErrorMessage(error)}`);
        setBulkProgress({ total: targetReviews.length, done, errors: [...errors], running: true });
      }
    }

    setBulkProgress({ total: targetReviews.length, done, errors, running: false });
    showToast(errors.length > 0 ? "Traitement terminé avec quelques erreurs." : "Les réponses Hans sont prêtes.", errors.length > 0 ? "error" : "success");
  }

  async function generateHansReply(review: Review) {
    if (loadingReviewId === review.id) {
      return;
    }

    setLoadingReviewId(review.id);
    setSelectedReviewId(review.id);
    setChatOpen(true);
    setReplyDraft(null);
    setReplyDraftId(null);
    setReplyStatus(null);
    setReplyEdited(false);
    showToast("Hans prépare votre réponse...", "saving");

    try {
      const data = await requestHansReply(review);

      updateReview(review.id, (current) => ({
        ...current,
        generatedReply: data.reply_text,
        generatedText: data.reply_text,
        generatedReplyId: data.reply_id,
        generatedReplyStatus: (data.reply_status as Review["generatedReplyStatus"]) ?? "generated",
        status: (data.review_status as Review["status"]) ?? current.status,
        isReplyEdited: false
      }));

      setReplyDraft(data.reply_text ?? null);
      setReplyDraftId(data.reply_id ?? null);
      setReplyStatus(data.reply_status ?? "generated");
      showToast(data.save_error ? `Réponse générée, mais non sauvegardée : ${data.save_error}` : "Réponse Hans générée", data.save_error ? "error" : "success");
    } catch (error) {
      showToast(getUserErrorMessage(error), "error");
    } finally {
      setLoadingReviewId(null);
    }
  }

  async function viewHansReply(review: Review) {
    openReviewInHans(review);

    if (review.generatedReply) {
      return;
    }

    try {
      const response = await fetchWithTimeout(`/api/hans/reply?review_id=${review.id}`);
      const data = (await response.json()) as {
        reply_id?: string;
        reply_text?: string;
        reply_status?: string;
        is_edited?: boolean;
        error?: string;
      };

      if (!response.ok || !data.reply_text) {
        return;
      }

      updateReview(review.id, (current) => ({
        ...current,
        generatedReply: data.reply_text,
        generatedText: data.reply_text,
        generatedReplyId: data.reply_id,
        generatedReplyStatus: data.reply_status as Review["generatedReplyStatus"],
        isReplyEdited: data.is_edited
      }));

      setReplyDraft(data.reply_text);
      setReplyDraftId(data.reply_id ?? null);
      setReplyStatus(data.reply_status ?? null);
      setReplyEdited(Boolean(data.is_edited));
    } catch {
      return;
    }
  }

  async function saveReplyEdit(replyText: string) {
    if (!selectedReview || !replyDraftId) {
      throw new Error("Aucune réponse à modifier.");
    }

    setSavingEditReviewId(selectedReview.id);
    showToast("Hans enregistre la modification...", "saving");

    try {
      const response = await fetchWithTimeout("/api/hans/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: selectedReview.id,
          reply_id: replyDraftId,
          reply_text: replyText
        })
      });

      const data = (await response.json()) as {
        reply_id?: string;
        reply_text?: string;
        is_edited?: boolean;
        error?: string;
      };

      if (!response.ok || !data.reply_text) {
        throw new Error(data.error ?? "Impossible d’enregistrer la modification.");
      }

      updateReview(selectedReview.id, (current) => ({
        ...current,
        generatedReply: data.reply_text,
        generatedText: data.reply_text,
        generatedReplyId: data.reply_id ?? current.generatedReplyId,
        isReplyEdited: data.is_edited ?? true
      }));

      setReplyDraft(data.reply_text);
      setReplyEdited(Boolean(data.is_edited ?? true));
      showToast("Réponse modifiée", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Impossible d’enregistrer la modification."), "error");
      throw error;
    } finally {
      setSavingEditReviewId(null);
    }
  }

  async function validateReview(review: Review, payload?: { replyId?: string | null; replyText?: string | null }) {
    if (publishingReviewId === review.id) {
      return;
    }

    setPublishingReviewId(review.id);
    showToast("Hans prépare la validation...", "saving");

    try {
      const data = await requestReplyValidation(review, {
        replyId: payload?.replyId ?? (review.id === selectedReview?.id ? replyDraftId : review.generatedReplyId),
        replyText: payload?.replyText ?? (review.id === selectedReview?.id ? replyDraft : review.generatedReply)
      });

      updateReview(review.id, (current) => ({
        ...current,
        generatedReplyId: data.reply_id ?? current.generatedReplyId,
        generatedReplyStatus: (data.reply_status as Review["generatedReplyStatus"]) ?? "validation_required",
        status: (data.review_status as Review["status"]) ?? "validation_required"
      }));

      if (selectedReview?.id === review.id) {
        setReplyStatus(data.reply_status ?? "validation_required");
      }

      showToast("Réponse prête pour validation finale ou publication.", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error), "error");
    } finally {
      setPublishingReviewId(null);
    }
  }

  async function publishHansReply() {
    if (!selectedReview) {
      return;
    }

    if (publishingReviewId === selectedReview.id) {
      return;
    }

    if (["validation_required", "ready_to_publish", "blocked_by_safety"].includes(normalizeStatus(selectedReview.status))) {
      setPublishingReviewId(selectedReview.id);

      try {
        const data = await requestReplyPublish(selectedReview, { replyId: replyDraftId, replyText: replyDraft, mode: "manual" });

        updateReview(selectedReview.id, (current) => ({
          ...current,
          status: (data.review_status as Review["status"]) ?? current.status,
          generatedReplyStatus: (data.reply_status as Review["generatedReplyStatus"]) ?? current.generatedReplyStatus
        }));
        setReplyStatus(data.reply_status ?? "published_manual");
        showToast("Réponse publiée sur Google.", "success");
      } catch (error) {
        showToast(getUserErrorMessage(error, "Impossible de publier la réponse."), "error");
      } finally {
        setPublishingReviewId(null);
      }

      return;
    }

    await validateReview(selectedReview, { replyId: replyDraftId, replyText: replyDraft });
  }

  async function toggleAutoReply(nextValue: boolean) {
    const previous = autoReplyEnabled;
    setAutoReplyEnabled(nextValue);
    setAutoReplySaving(true);

    try {
      const response = await fetchWithTimeout("/api/settings/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviews_auto_reply_enabled: nextValue
        })
      });

      if (!response.ok) {
        setAutoReplyEnabled(previous);
        showToast("Impossible d’enregistrer l’automatisation.", "error");
      }
    } catch (error) {
      setAutoReplyEnabled(previous);
      showToast(getUserErrorMessage(error, "Impossible d’enregistrer l’automatisation."), "error");
    } finally {
      setAutoReplySaving(false);
    }
  }

  useEffect(() => {
    if (!autoReplyEnabled) {
      return;
    }

    const targetReviews = localReviews.filter((review) => shouldAutoProcessReview(review) && !autoProcessStarted.current.has(review.id));

    if (targetReviews.length === 0) {
      return;
    }

    targetReviews.forEach((review) => autoProcessStarted.current.add(review.id));
    void processReviewsInBulk(targetReviews.slice(0, 10));
  }, [autoReplyEnabled, localReviews]);

  const heroSubtitle = counters.pending === 0 ? "Aucun avis à traiter" : `${counters.pending} avis nécessitent une réponse`;

  const emptyState = localReviews.length === 0;

  return (
    <div className={appShellStyles.page}>
      <Sidebar active="reviews" merchant={merchant} counters={counters} />
      <div className={appShellStyles.pageInner}>
        <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
        <main className={appShellStyles.content}>
          <div className={appShellStyles.width}>
            <div className="mx-auto max-w-[1180px] bg-[#F5F4FA] px-6 pb-20 pt-8">
              <section className="section-block rounded-[20px] border border-[#ECE9F4] bg-white px-7 py-6 shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="min-w-[260px] flex-1">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Avis Google</p>
                    <h1 className="text-[23px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Votre réputation est surveillée automatiquement par Hans.</h1>
                    <p className="mt-2 text-[14px] font-semibold text-[#6E6B80]">{heroSubtitle}</p>
                    <span className="mt-4 inline-flex rounded-full bg-[#F1EAFB] px-[13px] py-[7px] text-[12px] font-semibold text-[#4B2E83]">{automationSummary}</span>
                  </div>
                  <div className="flex flex-wrap gap-[10px]">
                    <Link href="/integrations" className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[18px] py-[11px] text-[13.5px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)] transition hover:shadow-[0_8px_22px_rgba(75,46,131,0.36)]">
                      {googleConnected ? "Importer les avis" : "Connecter Google"}
                    </Link>
                    <Link href="/reviews?filter=ready" className="inline-flex items-center gap-2 rounded-full border border-[#ECE9F4] bg-white px-[16px] py-[10px] text-[13.5px] font-semibold text-[#1E1B2E] transition hover:border-[#7C4DCB] hover:text-[#4B2E83]">
                      Valider les réponses
                    </Link>
                  </div>
                </div>
              </section>

              <section className="mb-[22px] grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Note moyenne" value={counters.total > 0 ? hansScore.averageRating.toFixed(1).replace(".", ",") : "0,0"} hint={counters.total > 0 ? `${counters.total} avis pris en compte` : "Connectez Google pour commencer"} showStars />
                <SummaryCard label="Nombre total d’avis" value={String(counters.total)} hint={counters.total > 0 ? "Votre base client se construit" : "Importez vos premiers avis"} />
                <SummaryCard label="Avis à traiter" value={String(counters.pending)} hint={counters.pending > 0 ? "Hans peut vous aider à répondre vite" : "Aucun avis en attente pour le moment"} tone="highlight" />
                <SummaryCard label="Réponses publiées" value={String(counters.answered)} hint={counters.answered > 0 ? "Votre réputation est bien suivie" : "Publiez vos premières réponses"} />
              </section>

              <section className="mb-[22px] grid gap-[18px] xl:grid-cols-[1.6fr_1fr]">
                <section className="rounded-[20px] border border-[#ECE9F4] bg-white px-5 pb-5 pt-[18px] shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                  <div className="mb-[14px] flex items-start justify-between gap-3">
                    <div>
                      <p className="mb-[2px] text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Hans</p>
                      <h2 className="mt-[6px] text-[16px] font-extrabold text-[#1E1B2E]">Ce que Hans recommande</h2>
                    </div>
                    <span className="inline-flex rounded-full bg-[#F1EAFB] px-[10px] py-1 text-[11.5px] font-semibold text-[#4B2E83]">{recommendations.length} priorités</span>
                  </div>

                  <div className="space-y-[10px]">
                    {recommendations.map((recommendation, index) => (
                      <article key={recommendation.id} className="rounded-[14px] border border-[#F1EEF8] bg-[#FDFCFE] px-4 py-[14px]">
                        <div className="mb-[5px] flex flex-wrap items-start justify-between gap-2">
                          <span className="text-[13.8px] font-bold text-[#1E1B2E]">{recommendation.title}</span>
                          <span className={getPriorityPillClass(recommendation.priority)}>{recommendation.priority}</span>
                        </div>
                        <p className="mb-2 text-[12.6px] leading-[1.5] text-[#6E6B80]">{recommendation.description}</p>
                        {index === 1 && recommendation.priority === "Haute" ? (
                          <div className="mb-[10px] flex items-center gap-[7px]">
                            <span className="flex gap-[3px]">{[0, 1, 2, 3, 4].map((step) => <span key={step} className={`h-[5px] w-[14px] rounded-[3px] ${step === 0 ? "bg-[#C7791F]" : "bg-[#F2F1F6]"}`} />)}</span>
                            <small className="text-[11px] font-semibold text-[#9895A8]">Priorité 1 sur 5</small>
                          </div>
                        ) : null}
                        {recommendation.href ? (
                          <Link href={recommendation.href} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[14px] py-[8px] text-[12.6px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)]">
                            {recommendation.actionLabel}
                          </Link>
                        ) : (
                          <button type="button" onClick={recommendation.onClick} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[14px] py-[8px] text-[12.6px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)]">
                            {recommendation.actionLabel}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-[20px] border border-[#ECE9F4] bg-white px-5 py-[18px] shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                  <p className="mb-[2px] text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Automatisation</p>
                  <h2 className="mt-[6px] text-[16px] font-extrabold text-[#1E1B2E]">Réponses automatiques Hans</h2>
                  <p className="mt-[6px] text-[12.8px] leading-[1.55] text-[#6E6B80]">Hans peut répondre automatiquement aux nouveaux avis pour accélérer votre suivi.</p>
                  <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#F1EEF8] bg-[#FDFCFE] px-[14px] py-[13px]">
                    <div className="min-w-[180px] flex-1">
                      <b className="mb-[3px] block text-[13px] text-[#1E1B2E]">Automatisation des avis</b>
                      <span className="text-[12px] leading-[1.4] text-[#6E6B80]">{automationSummary}</span>
                      {autoReplySaving ? <div className="mt-1 text-[11px] text-[#9895A8]">Sauvegarde en cours…</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleAutoReply(!autoReplyEnabled)}
                        className={`relative inline-flex h-8 w-[54px] items-center rounded-full p-1 transition ${autoReplyEnabled ? "bg-[#4B2E83]" : "bg-[#DEDBE8]"}`}
                        aria-pressed={autoReplyEnabled}
                      >
                        <span className={`h-6 w-6 rounded-full bg-white shadow-sm transition ${autoReplyEnabled ? "translate-x-[22px]" : "translate-x-0"}`} />
                      </button>
                      <Link href="/automations" className="inline-flex items-center rounded-full border border-[#ECE9F4] bg-white px-[13px] py-[7px] text-[12.6px] font-semibold text-[#1E1B2E] transition hover:border-[#7C4DCB] hover:text-[#4B2E83]">Configurer</Link>
                    </div>
                  </div>
                </section>
              </section>

              <button
                type="button"
                onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="section-block flex w-full items-center justify-between rounded-[20px] border border-[#ECE9F4] bg-white px-[22px] py-[14px] text-left shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)] transition hover:shadow-[0_10px_26px_rgba(46,26,84,0.08)]"
              >
                <span className="text-[13px] font-semibold text-[#5B2A9E]">Vue détaillée</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-[#5B2A9E]"><path d="M6 9l6 6 6-6" /></svg>
              </button>

              <section className="section-block" id="reviews">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Avis</p>
                    <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Les avis à gérer</h2>
                    <p className="mt-[6px] max-w-[560px] text-[13.5px] leading-[1.5] text-[#6E6B80]">Les avis urgents remontent automatiquement en premier pour vous aider à agir vite.</p>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[#ECE9F4] bg-white px-[14px] py-[9px] text-[#9895A8] shadow-[0_1px_2px_rgba(24,12,48,0.04)]">
                    <Icon name="search" className="h-[14px] w-[14px]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher un client ou un avis"
                      className="w-full border-0 bg-transparent text-[13px] text-[#1E1B2E] outline-none placeholder:text-[#9895A8]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 rounded-full bg-[#F2F1F6] p-[3px]">
                    {[
                      { label: "Tous", value: "all" },
                      { label: "À traiter", value: "pending" },
                      { label: "Avis négatifs", value: "negative" },
                      { label: "Réponses prêtes", value: "ready" },
                      { label: "Publiés", value: "published" }
                    ].map((item) => {
                      const isActive = activeFilter === item.value;
                      const href = item.value === "all" ? "/reviews" : `/reviews?filter=${item.value}`;

                      return (
                        <Link
                          key={item.value}
                          href={href}
                          className={`rounded-full px-3 py-[7px] text-[12.4px] font-semibold transition ${isActive ? "bg-[#4B2E83] text-white" : "text-[#6E6B80]"}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {emptyState ? (
                  <div className="rounded-[20px] border border-[#ECE9F4] bg-white px-5 py-10 text-center shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                    <h3 className="text-[18px] font-extrabold text-[#1E1B2E]">Aucun avis importé.</h3>
                    <p className="mx-auto mt-2 max-w-xl text-[14px] text-[#6E6B80]">Connectez votre fiche Google pour importer vos avis.</p>
                    <Link href="/integrations" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[18px] py-[11px] text-[13.5px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)]">
                      Connecter Google
                    </Link>
                  </div>
                ) : filteredReviews.length === 0 ? (
                  <div className="rounded-[20px] border border-[#ECE9F4] bg-white px-5 py-8 text-center text-[14px] text-[#6E6B80] shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                    Aucun avis ne correspond à ce filtre pour le moment.
                  </div>
                ) : (
                  <div>
                    {filteredReviews.map((review) => {
                      const busy = loadingReviewId === review.id || publishingReviewId === review.id;
                      const hasReply = Boolean(review.generatedReply || review.generatedReplyId);
                      const readyForReview = ["generated", "ready_to_publish", "validation_required", "blocked_by_safety"].includes(normalizeStatus(review.status)) || hasReply;

                      return (
                        <article key={review.id} className="mb-3 rounded-[20px] border border-[#ECE9F4] bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-[10px]">
                            <div className="flex items-center gap-[10px]">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[12.5px] font-bold text-white ${getAvatarClass(review.avatarColor)}`}>
                                {review.initials}
                              </div>
                              <div>
                                <div className="text-[13.5px] font-bold text-[#1E1B2E]">{review.author}</div>
                                <div className="text-[11.5px] text-[#9895A8]">{getDisplayDate(review.createdAt) || review.date}</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-[6px]">
                              {getReviewBadges(review).map((badge) => (
                                <span key={badge.label} className={badge.className}>{badge.label}</span>
                              ))}
                            </div>
                          </div>

                          <div className="mb-2 ml-[46px] flex gap-[2px] max-sm:ml-0">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <svg key={index} viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill={index < review.rating ? "#C7791F" : "#DEDBE8"}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z" /></svg>
                            ))}
                          </div>

                          <p className="mb-3 ml-[46px] text-[13px] leading-[1.55] text-[#1E1B2E] max-sm:ml-0">{review.text}</p>

                          {review.generatedReply ? (
                            <div className="mb-3 ml-[46px] rounded-[10px] border border-[#F1EAFB] bg-[#F8F5FC] px-[13px] py-[11px] max-sm:ml-0">
                              <div className="mb-[5px] flex items-center gap-[5px] text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5B2A9E]">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                Brouillon Hans
                              </div>
                              <p className="text-[12.6px] leading-[1.5] text-[#6E6B80]">{review.generatedReply}</p>
                            </div>
                          ) : null}

                          <div className="ml-[46px] flex flex-wrap gap-2 max-sm:ml-0">
                            {!hasReply ? (
                              <button type="button" onClick={() => void generateHansReply(review)} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[14px] py-[8px] text-[12.6px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)] disabled:cursor-not-allowed disabled:opacity-60">
                                {busy ? "Hans prépare..." : "Générer une réponse"}
                              </button>
                            ) : (
                              <button type="button" onClick={() => void viewHansReply(review)} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-[#ECE9F4] bg-white px-[13px] py-[7px] text-[12.6px] font-semibold text-[#1E1B2E] transition hover:border-[#7C4DCB] hover:text-[#4B2E83] disabled:cursor-not-allowed disabled:opacity-60">
                                Voir la réponse
                              </button>
                            )}

                            {readyForReview ? (
                              <button
                                type="button"
                                onClick={() => {
                                  openReviewInHans(review);
                                  if (normalizeStatus(review.status) === "generated") {
                                    void validateReview(review, { replyId: review.generatedReplyId, replyText: review.generatedReply });
                                    return;
                                  }

                                  void viewHansReply(review);
                                }}
                                disabled={busy}
                                className="inline-flex items-center gap-2 rounded-full border border-[#ECE9F4] bg-white px-[13px] py-[7px] text-[12.6px] font-semibold text-[#1E1B2E] transition hover:border-[#7C4DCB] hover:text-[#4B2E83] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busy ? "Chargement..." : normalizeStatus(review.status) === "ready_to_publish" ? "Publier" : "Ouvrir dans Hans"}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <details className="rounded-[20px] border border-[#ECE9F4] bg-white p-4 shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
              <summary className="cursor-pointer list-none text-sm font-bold text-[var(--color-primary)]">Mode développeur</summary>
              <div className="mt-4">
                <AdminReviewForm onCreated={addCreatedReview} onToast={showToast} />
                <DevResetReviewsButton
                  onReset={() => showToast("Avis tests réinitialisés. Rechargez la page si besoin.", "success")}
                  onClear={() => {
                    setLocalReviews((current) => current.filter((review) => !review.id.startsWith("mock-")));
                    showToast("Avis tests supprimés.", "success");
                  }}
                />
              </div>
              </details>
            </div>
          </div>
        </main>
      </div>

      <HansFloatingChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        selectedReview={selectedReview}
        reply={replyDraft}
        isGenerating={Boolean(selectedReview && loadingReviewId === selectedReview.id)}
        onGenerate={selectedReview ? () => void generateHansReply(selectedReview) : undefined}
        onRegenerate={selectedReview ? () => void generateHansReply(selectedReview) : undefined}
        onPublish={publishHansReply}
        isPublishing={Boolean(selectedReview && publishingReviewId === selectedReview.id)}
        onSaveEdit={saveReplyEdit}
        isSavingEdit={Boolean(selectedReview && savingEditReviewId === selectedReview.id)}
        isEdited={replyEdited}
        replyStatus={replyStatus}
      />
      <BulkReplyModal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} progress={bulkProgress} />
      <Toast toast={toast} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "default",
  showStars = false
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "highlight";
  showStars?: boolean;
}) {
  return (
    <article className="rounded-[20px] border border-[#ECE9F4] bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#9895A8]">{label}</div>
      <div className={`mt-2 flex items-center gap-2 text-[26px] font-extrabold tracking-[-0.01em] ${tone === "highlight" ? "text-[#C7791F]" : "text-[#1E1B2E]"}`}>{value}</div>
      {showStars ? (
        <div className="mt-2 flex gap-[2px]">
          {Array.from({ length: 5 }).map((_, index) => (
            <svg key={index} viewBox="0 0 24 24" className="h-3 w-3" fill={index < Math.round(Number(value.replace(",", "."))) ? "#C7791F" : "#DEDBE8"}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z" /></svg>
          ))}
        </div>
      ) : null}
      <p className="mt-[5px] text-[12px] text-[#9895A8]">{hint}</p>
    </article>
  );
}

function getAvatarClass(color: Review["avatarColor"]) {
  if (color === "red") return "bg-[linear-gradient(135deg,#D64545,#9A2E2E)]";
  if (color === "green") return "bg-[linear-gradient(135deg,#2E9E5B,#1D6C3D)]";
  if (color === "amber") return "bg-[linear-gradient(135deg,#C7791F,#9A5A16)]";
  if (color === "navy") return "bg-[linear-gradient(135deg,#4B2E83,#2E1A54)]";
  return "bg-[linear-gradient(135deg,#9895A8,#6E6B80)]";
}

function getPriorityPillClass(priority: HansRecommendation["priority"]) {
  if (priority === "Haute") return "inline-flex rounded-full bg-[#FBEAEA] px-[10px] py-1 text-[11.5px] font-semibold text-[#D64545]";
  if (priority === "Moyenne") return "inline-flex rounded-full bg-[#FBF0E1] px-[10px] py-1 text-[11.5px] font-semibold text-[#9A5A16]";
  return "inline-flex rounded-full bg-[#F2F1F6] px-[10px] py-1 text-[11.5px] font-semibold text-[#6E6B80]";
}

function getReviewBadges(review: Review) {
  const badges: Array<{ label: string; className: string }> = [];

  if (review.generatedReply) {
    badges.push({ label: "Réponse générée", className: "inline-flex rounded-full bg-[#F1EAFB] px-[10px] py-1 text-[11.5px] font-semibold text-[#4B2E83]" });
  }

  if (review.sentiment === "negatif" || review.rating <= 2) {
    badges.push({ label: "Négatif", className: "inline-flex rounded-full bg-[#FBEAEA] px-[10px] py-1 text-[11.5px] font-semibold text-[#D64545]" });
  } else if (["published", "repondu", "published_auto", "published_manual"].includes(normalizeStatus(review.status))) {
    badges.push({ label: "Publié", className: "inline-flex rounded-full bg-[#EAF7EE] px-[10px] py-1 text-[11.5px] font-semibold text-[#2E9E5B]" });
  } else if (["ready_to_publish", "validation_required", "blocked_by_safety"].includes(normalizeStatus(review.status))) {
    badges.push({ label: "À valider", className: "inline-flex rounded-full bg-[#FBF0E1] px-[10px] py-1 text-[11.5px] font-semibold text-[#9A5A16]" });
  } else {
    badges.push({ label: "À traiter", className: "inline-flex rounded-full bg-[#F2F1F6] px-[10px] py-1 text-[11.5px] font-semibold text-[#6E6B80]" });
  }

  return badges;
}
