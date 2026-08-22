"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/Toast";
import { CreatePostButton } from "@/components/CreatePostButton";
import { useToast } from "@/hooks/useToast";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { buildCreatePostHref } from "@/lib/social-recommendations";
import { getPostStatusLabel } from "@/lib/social-post-utils";
import type { Review } from "@/lib/mock-data";
import type { ReviewSocialPostIdea } from "@/lib/review-insights";
import type { MerchantAutomationSettingsRow, MerchantMediaAssetRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";
import { SocialCreateVisualCard } from "./SocialCreateVisualCard";

type InstagramConnectionLike = {
  status: "connected" | "disconnected" | "error" | "pending_configuration";
  instagram_username?: string | null;
  connected_at?: string | null;
  last_sync_at?: string | null;
  last_error?: string | null;
} | null;

type PostCategory = "draft" | "scheduled" | "published";
type InstagramOnboardingState = "disconnected" | "connecting" | "connected" | "action_required" | "pending_configuration" | "error";
type InstagramProfessionalAnswer = "yes" | "unsure" | "no" | null;

export function SocialPageClient({
  merchant,
  reviews,
  automationSettings,
  instagramConnection,
  instagramConfigured,
  schedulingConfigured,
  isInstagramUnavailable,
  instagramError,
  instagramSaved,
  cadence,
  posts: initialPosts,
  ideas,
  mediaAssets
}: {
  merchant?: MerchantRow | null;
  reviews: Review[];
  automationSettings: MerchantAutomationSettingsRow | null;
  instagramConnection: InstagramConnectionLike;
  instagramConfigured: boolean;
  schedulingConfigured: boolean;
  isInstagramUnavailable: boolean;
  instagramError: string | null;
  instagramSaved: boolean;
  cadence: { postsPerCycle: number; cycleWeeks: number };
  posts: SocialPostRow[];
  ideas: ReviewSocialPostIdea[];
  mediaAssets: MerchantMediaAssetRow[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleValues, setScheduleValues] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [visibleIdeasCount, setVisibleIdeasCount] = useState(Math.min(3, Math.max(ideas.length, 3)));
  const [postCategory, setPostCategory] = useState<PostCategory>("draft");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [instagramModalOpen, setInstagramModalOpen] = useState(false);
  const [instagramAnswer, setInstagramAnswer] = useState<InstagramProfessionalAnswer>(null);
  const [instagramActionState, setInstagramActionState] = useState<InstagramOnboardingState | null>(null);
  const [instagramCardMessage, setInstagramCardMessage] = useState<string | null>(instagramSaved ? "Votre compte Instagram est prêt. Vous pouvez créer votre premier post." : null);
  const [instagramActionBusy, setInstagramActionBusy] = useState<"redirect" | "test" | "disconnect" | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const instagramConnected = instagramConnection?.status === "connected" && instagramConfigured;
  const publishingConfigured = instagramConnected;
  const instagramUiState = useMemo<InstagramOnboardingState>(() => {
    if (instagramActionState) return instagramActionState;
    if (instagramConnected) return "connected";
    if (instagramConnection?.status === "pending_configuration") return "pending_configuration";
    if (instagramConnection?.status === "error") return "error";
    if (isInstagramUnavailable) return "error";
    if (instagramError) return isInstagramActionRequiredError(instagramError) ? "action_required" : "error";
    return "disconnected";
  }, [instagramActionState, instagramConnected, instagramConnection?.status, isInstagramUnavailable, instagramError]);
  const instagramUiMessage = useMemo(
    () => instagramCardMessage ?? mapInstagramConnectionMessage({
      state: instagramUiState,
      rawError: instagramError,
      connectionError: instagramConnection?.last_error ?? null,
      configured: instagramConfigured
    }),
    [instagramCardMessage, instagramUiState, instagramError, instagramConnection?.last_error, instagramConfigured]
  );
  const instagramDisplayName = instagramConnection?.instagram_username?.trim() || merchant?.business_name || "Instagram";
  const instagramInitials = getInstagramInitials(instagramDisplayName);
  const instagramLastCheck = instagramConnection?.last_sync_at ?? instagramConnection?.connected_at ?? null;
  const orderedPosts = useMemo(
    () => posts.slice().sort((left, right) => new Date(right.scheduled_at ?? right.updated_at).getTime() - new Date(left.scheduled_at ?? left.updated_at).getTime()),
    [posts]
  );
  const postCounts = useMemo(
    () => orderedPosts.reduce<Record<PostCategory, number>>(
      (counts, post) => {
        counts[getPostCategory(post)] += 1;
        return counts;
      },
      { draft: 0, scheduled: 0, published: 0 }
    ),
    [orderedPosts]
  );
  const filteredPosts = useMemo(
    () => orderedPosts.filter((post) => getPostCategory(post) === postCategory),
    [orderedPosts, postCategory]
  );
  const draftToResume = orderedPosts.find((post) => post.status !== "published");
  const recommendationCount = ideas.length;
  const displayedIdeas = useMemo(() => ideas.slice(0, visibleIdeasCount), [ideas, visibleIdeasCount]);

  async function deletePost(postId: string) {
    if (busyId === postId) return;
    setBusyId(postId);
    try {
      const response = await fetchWithTimeout(`/api/social/posts/${postId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Suppression impossible.");
      setPosts((current) => current.filter((post) => post.id !== postId));
      setOpenMenuId(null);
      setShareMenuId(null);
      showToast("Post supprimé", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Suppression impossible."), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function publishPost(postId: string) {
    if (busyId === postId) return;
    setBusyId(postId);
    try {
      const response = await fetchWithTimeout(`/api/social/posts/${postId}/publish-instagram`, { method: "POST" });
      const data = (await response.json()) as { post?: SocialPostRow; error?: string; queued?: boolean };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Publication impossible.");
      setPosts((current) => current.map((post) => (post.id === postId ? data.post! : post)));
      setOpenMenuId(null);
      setShareMenuId(null);
      if (data.queued) {
        setPostCategory("published");
        showToast("Publication en cours sur Instagram…", "success");
      } else {
        showToast("Post publié sur Instagram", "success");
      }
    } catch (error) {
      showToast(getUserErrorMessage(error, "Publication impossible."), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function downloadPost(post: SocialPostRow) {
    const sourceUrl = post.visual_url ?? post.image_url;
    if (!sourceUrl) {
      showToast("Aucun visuel à télécharger pour ce post.", "error");
      return;
    }

    try {
      const response = await fetchWithTimeout(sourceUrl, { method: "GET" });
      if (!response.ok) throw new Error("Téléchargement impossible.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${post.title || "publication-instagram"}.png`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setShareMenuId(null);
      showToast("Visuel téléchargé", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Téléchargement impossible."), "error");
    }
  }

  async function duplicatePost(postId: string) {
    if (busyId === postId) return;
    setBusyId(postId);
    try {
      const response = await fetchWithTimeout(`/api/social/posts/${postId}/duplicate`, { method: "POST" });
      const data = (await response.json()) as { post?: SocialPostRow; error?: string };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Duplication impossible.");
      setPosts((current) => [data.post!, ...current]);
      setOpenMenuId(null);
      setShareMenuId(null);
      setPostCategory("draft");
      showToast("Post dupliqué", "success");
      router.push(`/social/editor/${data.post.id}`);
    } catch (error) {
      showToast(getUserErrorMessage(error, "Duplication impossible."), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function schedulePost(postId: string) {
    const value = scheduleValues[postId];
    if (!value) {
      showToast("Choisissez une date de publication.", "error");
      return;
    }
    const post = posts.find((candidate) => candidate.id === postId);
    if (!post) {
      showToast("Post introuvable.", "error");
      return;
    }
    if (!publishingConfigured) {
      showToast("Connectez Instagram avant de planifier.", "error");
      return;
    }
    if (!schedulingConfigured) {
      showToast("La planification serveur doit encore être configurée.", "error");
      return;
    }
    const scheduledAt = new Date(value);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      showToast("Choisissez une date future.", "error");
      return;
    }
    if (!hasFinalPng(post)) {
      router.push(buildEditorActionHref(post.id, "schedule", scheduledAt.toISOString()));
      return;
    }
    if (busyId === postId) return;
    setBusyId(postId);
    try {
      const response = await fetchWithTimeout(`/api/social/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          scheduled_at: scheduledAt.toISOString(),
          published_at: null,
          error_message: null
        })
      });
      const data = (await response.json()) as { post?: SocialPostRow; error?: string };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Planification impossible.");
      setPosts((current) => current.map((post) => (post.id === postId ? data.post! : post)));
      setOpenMenuId(null);
      setShareMenuId(null);
      setPostCategory("scheduled");
      showToast("Post planifié", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Planification impossible."), "error");
    } finally {
      setBusyId(null);
    }
  }

  function continueToInstagram() {
    if (instagramActionBusy) return;

    setInstagramActionBusy("redirect");
    setInstagramActionState("connecting");
    setInstagramCardMessage("Redirection sécurisée vers Instagram…");
    window.location.assign("/api/instagram/connect");
  }

  async function testInstagramConnection() {
    if (instagramActionBusy) return;
    setInstagramActionBusy("test");
    try {
      const response = await fetchWithTimeout("/api/instagram/test", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Test impossible.");
      }
      setInstagramCardMessage(data.message ?? "Connexion Instagram vérifiée.");
      showToast(data.message ?? "Connexion Instagram vérifiée.", "success");
    } catch (error) {
      const message = getUserErrorMessage(error, "Impossible de vérifier la connexion Instagram.");
      setInstagramCardMessage(message);
      showToast(message, "error");
    } finally {
      setInstagramActionBusy(null);
    }
  }

  async function disconnectInstagram() {
    if (instagramActionBusy) return;
    setInstagramActionBusy("disconnect");
    try {
      const response = await fetchWithTimeout("/api/instagram/disconnect", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Déconnexion impossible.");
      }
      setInstagramCardMessage("Le compte Instagram a été déconnecté.");
      showToast("Compte Instagram déconnecté", "success");
      window.location.href = "/social";
    } catch (error) {
      const message = getUserErrorMessage(error, "Déconnexion impossible.");
      setInstagramCardMessage(message);
      showToast(message, "error");
      setInstagramActionBusy(null);
    }
  }

  const stepStatus = {
    ideaReady: ideas.length > 0,
    postPrepared: posts.some((post) => post.status !== "published"),
    publicationReady: publishingConfigured
  };

  return (
    <>
      <div className="mx-auto max-w-[1180px] bg-[#F5F4FA] px-6 pb-20 pt-8">
        <div className="section-block">
          <div className="card hero rounded-[20px] border border-[#ECE9F4] bg-white px-7 py-[26px] shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
            <div className="hero-top flex flex-wrap justify-between gap-7">
              <div className="hero-left min-w-[280px] flex-1">
                <p className="eyebrow mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Instagram</p>
                <h1 className="mb-[10px] text-[24px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Hans vous aide à préparer vos prochains posts.</h1>
                <p className="desc mb-4 max-w-[480px] text-[14.5px] leading-[1.55] text-[#6E6B80]">
                  Choisissez une idée, créez un post, puis publiez-le quand votre compte est connecté.
                </p>
                <div className="hero-actions mb-[14px] flex flex-wrap items-center gap-4">
                  <Link href="/social#create-with-hans" className="btn btn-primary inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[18px] py-[11px] text-[13.5px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)] transition hover:shadow-[0_8px_22px_rgba(75,46,131,0.36)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Créer un post
                  </Link>
                  <a href="#recommendations" className="link inline-flex items-center gap-1 text-[13px] font-semibold text-[#5B2A9E] hover:underline">
                    Voir les idées de Hans
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </a>
                </div>
                <span className="pill pill-purple inline-flex rounded-full bg-[#F1EAFB] px-[10px] py-1 text-[11.5px] font-semibold text-[#4B2E83]">
                  {automationSettings?.social_auto_publish_enabled
                    ? `✨ Préparation automatique active · ${cadence.postsPerCycle} post${cadence.postsPerCycle > 1 ? "s" : ""} toutes les ${cadence.cycleWeeks} semaine${cadence.cycleWeeks > 1 ? "s" : ""}`
                    : "🔒 Vous gardez la main sur vos publications"}
                </span>
              </div>

              <div className="stepper w-[270px] shrink-0 max-md:w-full">
                <div className="stepper-title mb-3 flex items-center gap-2 text-xs font-bold text-[#6E6B80]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B2A9E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  Comment ça marche
                </div>
                <StepperRow state={stepStatus.ideaReady ? "done" : "active"} label="Idée recommandée" detail={ideas[0] ? "Hans analyse vos avis" : "En attente d'analyse"} />
                <StepperRow state={stepStatus.postPrepared ? "active" : "idle"} label="Post préparé par Hans" detail={stepStatus.postPrepared ? "Prêt à relire et modifier" : "Créez votre premier post"} />
                <StepperRow state={stepStatus.publicationReady ? "done" : "blocked"} label="Publication au bon moment" detail={stepStatus.publicationReady ? "Instagram prêt à publier" : "Instagram à connecter"} />
              </div>
            </div>

            <InstagramConnectionCard
              state={instagramUiState}
              username={instagramConnection?.instagram_username ?? null}
              displayName={instagramDisplayName}
              initials={instagramInitials}
              message={instagramUiMessage}
              lastCheck={instagramLastCheck}
              busyAction={instagramActionBusy}
              onConnect={() => {
                setInstagramAnswer(null);
                setInstagramModalOpen(true);
              }}
              onTest={() => void testInstagramConnection()}
              onSwitchAccount={() => {
                setInstagramAnswer("yes");
                setInstagramModalOpen(true);
              }}
              onDisconnect={() => void disconnectInstagram()}
              onCreateFirstPost={() => router.push("/social#create-with-hans")}
            />
          </div>
        </div>

        <div className="section-block">
          <SocialCreateVisualCard galleryAssets={mediaAssets} />
        </div>

        <section id="recommendations" className="section-block">
          <div className="section-head mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Ce que Hans recommande</p>
              <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Des idées construites à partir de vos avis et de vos images</h2>
            </div>
            <Link href="/reviews/insights" className="link inline-flex items-center gap-1 text-[13px] font-semibold text-[#5B2A9E] hover:underline">
              Relancer l&apos;analyse
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 3 6.7"/><path d="M3 16v-4h4"/></svg>
            </Link>
          </div>

          <div className="reco-toolbar mb-4 flex flex-wrap items-center gap-[10px]">
            <span className="count-chip text-[12.5px] text-[#6E6B80]"><b className="text-[#1E1B2E]">{recommendationCount}</b> recommandations disponibles</span>
            <div className="segmented flex rounded-full bg-[#F2F1F6] p-[3px]">
              <button type="button" onClick={() => setVisibleIdeasCount(3)} className={`rounded-full px-[13px] py-[6px] text-[12.5px] font-semibold ${visibleIdeasCount === 3 ? "bg-white text-[#4B2E83] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#6E6B80]"}`}>
                3 idées
              </button>
              <button type="button" onClick={() => setVisibleIdeasCount(Math.max(6, recommendationCount))} className={`rounded-full px-[13px] py-[6px] text-[12.5px] font-semibold ${visibleIdeasCount !== 3 ? "bg-white text-[#4B2E83] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#6E6B80]"}`}>
                Toutes ({recommendationCount})
              </button>
            </div>
          </div>

          {ideas.length === 0 ? (
            <div className="rounded-[20px] border border-[#ECE9F4] bg-white p-6 text-sm text-[#6E6B80] shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
              Aucune recommandation disponible pour le moment. Analysez davantage d’avis pour générer de nouvelles idées de posts.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {displayedIdeas.map((idea, index) => {
                const revealKey = `idea-${index}`;
                const sourceLabel = idea.sourcePainPoint ?? idea.sourceStrength ?? idea.seasonalMoment ?? idea.assetAltText ?? "Avis clients";
                const sourceExample = findSourceExample(reviews, sourceLabel);
                return (
                  <div key={`${idea.title}-${index}`} className="reco-card flex flex-col gap-[10px] rounded-[20px] border border-[#ECE9F4] bg-white px-[18px] pb-4 pt-[18px] shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)] transition hover:-translate-y-[2px] hover:shadow-[0_10px_28px_rgba(46,26,84,0.1)]">
                    <div className="reco-top-row flex items-center justify-between">
                      <span className="pill pill-purple inline-flex rounded-full bg-[#F1EAFB] px-[10px] py-1 text-[11.5px] font-semibold text-[#4B2E83]">{idea.platform === "instagram" ? "Instagram" : "Facebook"}</span>
                      <span className="reco-by text-[11.5px] font-semibold text-[#9895A8]">Hans</span>
                    </div>
                    <h3 className="reco-title text-[14px] font-bold leading-[1.35] text-[#1E1B2E]">{idea.title}</h3>
                    <p className="reco-text flex-1 text-[12.6px] leading-[1.5] text-[#6E6B80]">{idea.angle}</p>
                    <button type="button" onClick={() => setExpandedSources((current) => ({ ...current, [revealKey]: !current[revealKey] }))} className="source-chip w-full rounded-[10px] border border-dashed border-[#DEDBE8] px-[10px] py-2 text-left">
                      <span className="label mb-[2px] flex items-center gap-[5px] text-[11px] font-bold text-[#5B2A9E]">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>
                        Source
                      </span>
                      <span className="value text-xs text-[#6E6B80]">{sourceLabel}</span>
                    </button>
                    {expandedSources[revealKey] ? (
                      <div className="source-reveal rounded-[10px] bg-[#F8F5FC] px-[9px] py-2 text-[11.8px] leading-[1.45] text-[#6E6B80]">
                        {sourceExample ? <><b>{sourceExample.author} · {sourceExample.date}</b> — {sourceExample.text}</> : <><b>Source détectée</b> — Cette recommandation vient du thème “{sourceLabel}”.</>}
                      </div>
                    ) : null}
                    <CreatePostButton
                      href={buildCreatePostHref(idea)}
                      className="btn btn-primary sm inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-[14px] py-[9px] text-[12.8px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)] transition hover:shadow-[0_8px_22px_rgba(75,46,131,0.36)]"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="section-block">
          <div className="section-head mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Suivi</p>
              <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Mes posts</h2>
              <p className="desc mt-[6px] max-w-[520px] text-[13.5px] leading-[1.5] text-[#6E6B80]">Retrouvez vos brouillons, vos publications programmées et vos posts déjà prêts.</p>
            </div>
            <button type="button" onClick={() => (draftToResume ? router.push(`/social/editor/${draftToResume.id}`) : router.push("/social#create-with-hans"))} className="link inline-flex items-center gap-1 text-[13px] font-semibold text-[#5B2A9E] hover:underline">
              Reprendre un brouillon
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          <div className="relative mb-3 grid w-full max-w-[490px] grid-cols-3 rounded-[14px] border border-[#E8E3F0] bg-[#F5F2FA] p-1">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-[10px] bg-white shadow-[0_2px_10px_rgba(75,46,131,0.12)] transition-transform duration-300 ease-out"
              style={{
                width: "calc((100% - 8px) / 3)",
                transform: `translateX(${(["draft", "scheduled", "published"] as PostCategory[]).indexOf(postCategory) * 100}%)`
              }}
            />
            {([
              { value: "draft", label: "Brouillons" },
              { value: "scheduled", label: "Planifiés" },
              { value: "published", label: "Publiés" }
            ] as { value: PostCategory; label: string }[]).map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => {
                  setPostCategory(category.value);
                  setOpenMenuId(null);
                  setShareMenuId(null);
                }}
                aria-pressed={postCategory === category.value}
                className={`relative z-[1] flex min-w-0 items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold transition-colors duration-300 ${
                  postCategory === category.value ? "text-[#4B2E83]" : "text-[#777287] hover:text-[#4B2E83]"
                }`}
              >
                <span className="truncate">{category.label}</span>
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold transition-colors duration-300 ${
                  postCategory === category.value ? "bg-[#EEE6FA] text-[#5B2A9E]" : "bg-white/70 text-[#8E899B]"
                }`}>
                  {postCounts[category.value]}
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-visible rounded-[20px] border border-[#ECE9F4] bg-white shadow-[0_1px_2px_rgba(24,12,48,0.04),0_8px_24px_rgba(24,12,48,0.05)]">
            <div key={postCategory} className="posts-list flex flex-col animate-[posts-filter-in_220ms_ease-out]">
              {filteredPosts.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[#6E6B80]">{getEmptyPostCategoryMessage(postCategory)}</div>
              ) : (
                filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/social/editor/${post.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/social/editor/${post.id}`);
                      }
                    }}
                    className="post-row grid cursor-pointer grid-cols-[88px_minmax(0,1fr)_110px_auto] items-center gap-4 border-b border-[#F1EEF8] px-5 py-4 transition hover:bg-[#FCFBFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7C4DCB] last:border-b-0 max-md:grid-cols-1 max-md:items-start"
                  >
                    <div className="post-thumb relative h-[88px] w-[88px] overflow-hidden rounded-[16px] border border-[#ECE9F4] bg-[#F8F5FC] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] max-md:w-full max-md:max-w-[120px]">
                      {post.visual_url || post.image_url ? (
                        <img src={post.visual_url ?? post.image_url ?? ""} alt={post.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[24px] text-white" style={{ background: getPostThumbBackground(post, merchant?.business_type) }}>
                          {getPostEmoji(post.title)}
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/35 to-transparent" />
                    </div>
                    <div className="post-main min-w-0 self-center">
                      <div className="post-date mb-[3px] text-[11px] font-semibold text-[#9895A8]">
                        {post.scheduled_at ? formatSocialDate(post.scheduled_at) : "Non planifié"}
                      </div>
                      <p className="post-title mb-[3px] text-[13.5px] font-bold text-[#1E1B2E]">{post.title}</p>
                      <p className="post-desc line-clamp-2 max-w-[640px] text-[12.8px] leading-[1.5] text-[#6E6B80]">{post.caption}</p>
                    </div>
                    <div className="post-status self-center max-md:w-full">
                      <span className={`inline-flex rounded-full px-[10px] py-1 text-[11.5px] font-semibold ${getPostStatusClass(post.status, post, currentTime)}`}>
                        {getVisiblePostStatus(post, currentTime)}
                      </span>
                    </div>
                    <div className="post-actions relative flex shrink-0 items-center justify-end gap-2 max-md:w-full max-md:justify-start" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Partager"
                          title="Partager"
                          onClick={() => {
                            setShareMenuId((current) => (current === post.id ? null : post.id));
                            setOpenMenuId(null);
                          }}
                          disabled={busyId === post.id}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DED7EA] bg-white text-[#5B2A9E] shadow-sm transition hover:border-[#7C4DCB] hover:bg-[#F5F0FF] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5"/><path d="M15.4 6.5 8.6 10.5"/></svg>
                        </button>
                        <div className={`absolute right-0 top-[40px] z-30 w-[230px] rounded-[14px] border border-[#ECE9F4] bg-white p-2 shadow-[0_12px_28px_rgba(24,12,48,0.14)] ${shareMenuId === post.id ? "block" : "hidden"}`}>
                          <button type="button" onClick={() => hasFinalPng(post) ? void downloadPost(post) : router.push(buildEditorActionHref(post.id, "download"))} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[12.8px] font-semibold text-[#1E1B2E] hover:bg-[#F8F5FC]">
                            <span className="text-base">↓</span>
                            Télécharger
                          </button>
                          <button type="button" onClick={() => hasFinalPng(post) ? void publishPost(post.id) : router.push(buildEditorActionHref(post.id, "publish"))} disabled={!publishingConfigured || hasPublicationStarted(post) || busyId === post.id} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[12.8px] font-semibold text-[#1E1B2E] hover:bg-[#F8F5FC] disabled:cursor-not-allowed disabled:opacity-45">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[linear-gradient(135deg,#833AB4,#FD1D1D,#FCAF45)] text-[10px] font-black text-white">IG</span>
                            {isPublicationPending(post, currentTime) ? "Publication en cours…" : hasPublicationStarted(post) ? "Publié sur Instagram" : "Publier sur Instagram"}
                          </button>
                          <button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-[12.8px] font-semibold text-[#9895A8] opacity-70">
                            <span className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1877F2] text-[11px] font-black text-white">f</span>Publier sur Facebook</span>
                            <span className="text-[10px] font-bold uppercase">Non disponible</span>
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Planifier"
                          title={!schedulingConfigured ? "Planification serveur non configurée" : "Planifier"}
                          disabled={!schedulingConfigured || !publishingConfigured || busyId === post.id}
                          onClick={() => {
                            setOpenMenuId((current) => (current === post.id ? null : post.id));
                            setShareMenuId(null);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DED7EA] bg-white text-[#5B2A9E] shadow-sm transition hover:border-[#7C4DCB] hover:bg-[#F5F0FF] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M12 14v4M10 16h4"/></svg>
                        </button>
                        <div className={`absolute right-0 top-[40px] z-30 w-[240px] rounded-[14px] border border-[#ECE9F4] bg-white p-3 shadow-[0_12px_28px_rgba(24,12,48,0.14)] ${openMenuId === post.id ? "block" : "hidden"}`}>
                          <label className="mb-2 block text-[11px] font-semibold text-[#9895A8]">Date et heure de publication</label>
                          <input type="datetime-local" value={scheduleValues[post.id] ?? ""} onChange={(event) => setScheduleValues((current) => ({ ...current, [post.id]: event.target.value }))} className="w-full rounded-[10px] border border-[#ECE9F4] px-2 py-2 text-[12.5px] text-[#1E1B2E]" />
                          <button type="button" onClick={() => void schedulePost(post.id)} className="mt-2 flex w-full items-center justify-center rounded-[10px] bg-[#5B2A9E] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#4B237F]">
                            Planifier
                          </button>
                        </div>
                      </div>
                      <button type="button" aria-label="Dupliquer" title="Dupliquer" onClick={() => void duplicatePost(post.id)} disabled={busyId === post.id} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DED7EA] bg-white text-[#5B2A9E] shadow-sm transition hover:border-[#7C4DCB] hover:bg-[#F5F0FF] disabled:cursor-not-allowed disabled:opacity-40">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
                      </button>
                      <button type="button" aria-label="Supprimer" title="Supprimer" onClick={() => void deletePost(post.id)} disabled={busyId === post.id} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F3CACA] bg-[#FFF7F7] text-[#D64545] shadow-sm transition hover:border-[#D64545] hover:bg-[#FDECEC] disabled:cursor-not-allowed disabled:opacity-40">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
      <InstagramConnectionModal
        open={instagramModalOpen}
        answer={instagramAnswer}
        loading={instagramActionBusy === "redirect" || instagramUiState === "connecting"}
        onClose={() => {
          if (instagramActionBusy === "redirect") return;
          setInstagramModalOpen(false);
          setInstagramAnswer(null);
        }}
        onSelectAnswer={setInstagramAnswer}
        onContinue={() => void continueToInstagram()}
      />
      <Toast toast={toast} />
    </>
  );
}

function InstagramConnectionCard({
  state,
  username,
  displayName,
  initials,
  message,
  lastCheck,
  busyAction,
  onConnect,
  onTest,
  onSwitchAccount,
  onDisconnect,
  onCreateFirstPost
}: {
  state: InstagramOnboardingState;
  username: string | null;
  displayName: string;
  initials: string;
  message: string;
  lastCheck: string | null;
  busyAction: "redirect" | "test" | "disconnect" | null;
  onConnect: () => void;
  onTest: () => void;
  onSwitchAccount: () => void;
  onDisconnect: () => void;
  onCreateFirstPost: () => void;
}) {
  const connected = state === "connected";
  const primaryLabel = connected ? "Créer mon premier post" : state === "connecting" ? "Redirection sécurisée vers Instagram…" : "Se connecter avec Instagram";
  const statusLabel = getInstagramStatusLabel(state);
  const cardTone = connected
    ? "border-[#CFEAD8] bg-[#EAF7EE]"
    : state === "error" || state === "action_required"
      ? "border-[#F5C2C7] bg-[#FFF5F5]"
      : "border-[#E9D5FF] bg-[#FBFAFF]";

  return (
    <section className={`mt-[18px] rounded-[18px] border px-5 py-5 ${cardTone}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-[linear-gradient(135deg,#4B2E83,#A855F7)] text-lg font-black text-white shadow-[0_12px_30px_rgba(76,29,149,0.18)]">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Instagram</p>
            <h3 className="text-[22px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">
              {connected ? "Compte Instagram connecté" : "Connectez votre compte Instagram"}
            </h3>
            <p className="mt-1 text-[14px] leading-[1.6] text-[#6E6B80]">
              {connected
                ? "Votre compte est prêt pour publier et planifier vos contenus directement depuis Atrium One."
                : "Publiez et planifiez vos contenus directement depuis Atrium One."}
            </p>
            {!connected ? (
              <p className="mt-2 text-[12.5px] font-semibold text-[#6E6B80]">Vous devez disposer d’un compte Instagram professionnel.</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-[11.5px] font-semibold ${connected ? "bg-white text-[#2E9E5B]" : "bg-white text-[#5B2A9E]"}`}>
                {statusLabel}
              </span>
              {username ? (
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-[#4B2E83]">
                  @{username}
                </span>
              ) : null}
            </div>
            <p className="mt-3 max-w-[640px] text-[13px] leading-[1.55] text-[#6E6B80]">{message}</p>
            {connected ? (
              <div className="mt-4 flex flex-wrap items-center gap-5 text-[12.5px] text-[#6E6B80]">
                <div>
                  <span className="font-semibold text-[#1E1B2E]">Compte :</span> {displayName}
                </div>
                <div>
                  <span className="font-semibold text-[#1E1B2E]">Dernière vérification :</span> {lastCheck ? formatSocialDate(lastCheck) : "Connexion récente"}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex w-full max-w-[320px] flex-col gap-3 lg:items-end">
          <button
            type="button"
            onClick={connected ? onCreateFirstPost : onConnect}
            disabled={state === "connecting"}
            className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-5 py-3 text-[13.5px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)] transition hover:shadow-[0_8px_22px_rgba(75,46,131,0.36)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {primaryLabel}
          </button>

          {connected ? (
            <div className="flex w-full flex-wrap gap-2 lg:justify-end">
              <button type="button" onClick={onTest} disabled={busyAction !== null} className="rounded-full border border-[#E3DAF1] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4B2E83] transition hover:border-[#7C4DCB] disabled:opacity-50">
                {busyAction === "test" ? "Vérification…" : "Tester"}
              </button>
              <button type="button" onClick={onSwitchAccount} disabled={busyAction !== null} className="rounded-full border border-[#E3DAF1] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#4B2E83] transition hover:border-[#7C4DCB] disabled:opacity-50">
                Changer de compte
              </button>
              <button type="button" onClick={onDisconnect} disabled={busyAction !== null} className="rounded-full border border-[#F3CACA] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#B42318] transition hover:border-[#E06B6B] disabled:opacity-50">
                {busyAction === "disconnect" ? "Déconnexion…" : "Déconnecter"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function InstagramConnectionModal({
  open,
  answer,
  loading,
  onClose,
  onSelectAnswer,
  onContinue
}: {
  open: boolean;
  answer: InstagramProfessionalAnswer;
  loading: boolean;
  onClose: () => void;
  onSelectAnswer: (answer: InstagramProfessionalAnswer) => void;
  onContinue: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211432]/55 px-4 py-6">
      <div role="dialog" aria-modal="true" className="w-full max-w-[560px] rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_24px_80px_rgba(33,20,50,0.28)] [animation:modal-in_0.2s_ease]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Connexion Instagram</p>
            <h3 className="text-[22px] font-extrabold tracking-[-0.01em] text-[#1E1B2E]">Votre compte Instagram est-il professionnel ?</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#ECE9F4] px-3 py-1.5 text-[12px] font-semibold text-[#6E6B80]">
            Fermer
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {([
            { value: "yes", label: "Oui" },
            { value: "unsure", label: "Je ne sais pas" },
            { value: "no", label: "Non" }
          ] as { value: Exclude<InstagramProfessionalAnswer, null>; label: string }[]).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelectAnswer(option.value)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                answer === option.value ? "border-[#7C4DCB] bg-[#F7F1FF] text-[#4B2E83]" : "border-[#ECE9F4] bg-white text-[#1E1B2E] hover:border-[#D9C9F4]"
              }`}
            >
              <div className="text-sm font-bold">{option.label}</div>
            </button>
          ))}
        </div>

        {answer === "unsure" || answer === "no" ? (
          <div className="mt-4 rounded-2xl border border-[#ECE9F4] bg-[#FBFAFF] p-4 text-[13px] leading-[1.6] text-[#6B617F]">
            <p className="font-semibold text-[#1E1B2E]">Comment passer votre compte en professionnel</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Ouvrez Instagram puis allez dans votre profil.</li>
              <li>Entrez dans <span className="font-semibold">Paramètres et activité</span>.</li>
              <li>Choisissez <span className="font-semibold">Type de compte et outils</span>.</li>
              <li>Appuyez sur <span className="font-semibold">Passer à un compte professionnel</span>.</li>
              <li>Reliez ensuite votre compte à une Page Facebook si Instagram vous le demande.</li>
            </ol>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-[#8B7AA8]">
            {loading ? "Redirection sécurisée vers Instagram…" : "Vous pourrez choisir ou confirmer votre compte pendant la connexion."}
          </p>
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-5 py-3 text-[13.5px] font-semibold text-white shadow-[0_6px_18px_rgba(75,46,131,0.28)] transition hover:shadow-[0_8px_22px_rgba(75,46,131,0.36)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Redirection sécurisée vers Instagram…" : "Continuer vers Instagram"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepperRow({
  state,
  label,
  detail
}: {
  state: "done" | "active" | "blocked" | "idle";
  label: string;
  detail: string;
}) {
  return (
    <div className="step-row relative flex gap-[10px] pb-4 last:pb-0">
      <div className={`step-dot relative z-[1] flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        state === "done" ? "bg-[#2E9E5B] text-white" : state === "active" ? "bg-[#4B2E83] text-white" : state === "blocked" ? "bg-[#FBF0E1] text-[#9A5A16]" : "bg-[#F2F1F6] text-[#9895A8]"
      }`}>
        {state === "done" ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        ) : state === "blocked" ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>
        ) : (
          <span>{state === "active" ? "2" : "•"}</span>
        )}
      </div>
      <div className="step-text">
        <b className="block text-[12.8px] font-bold text-[#1E1B2E]">{label}</b>
        <span className={`text-[11.5px] ${state === "blocked" ? "font-semibold text-[#9A5A16]" : "text-[#9895A8]"}`}>{detail}</span>
      </div>
    </div>
  );
}

function findSourceExample(reviews: Review[], sourceLabel: string) {
  const normalized = sourceLabel.toLowerCase();
  const match = reviews.find((review) => review.text.toLowerCase().includes(normalized.slice(0, 18)));
  if (!match) return null;
  return { author: match.author, date: match.date, text: match.text };
}

function formatSocialDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getPostThumbBackground(post: SocialPostRow, businessType?: string | null) {
  const base = `${post.title}-${businessType ?? ""}`.toLowerCase();
  if (base.includes("fleur") || base.includes("bouquet")) return "linear-gradient(135deg,#E8B4C8,#C97B9A)";
  if (base.includes("avis") || base.includes("attaque")) return "linear-gradient(135deg,#7C4DCB,#4B2E83)";
  if (base.includes("rentrée") || base.includes("saison")) return "linear-gradient(135deg,#4B2E83,#1E1B2E)";
  return "linear-gradient(135deg,#7C4DCB,#4B2E83)";
}

function getPostEmoji(title: string) {
  const value = title.toLowerCase();
  if (value.includes("fleur") || value.includes("bouquet")) return "🌸";
  if (value.includes("avis") || value.includes("attaque")) return "🌿";
  if (value.includes("rentrée") || value.includes("saison")) return "🏠";
  return "✨";
}

function getPostStatusClass(status: SocialPostRow["status"], post: SocialPostRow, currentTime: number) {
  if (isPublicationPending(post, currentTime)) return "bg-[#FBF0E1] text-[#9A5A16]";
  if (hasPublicationStarted(post) || status === "published") return "bg-[#EAF7EE] text-[#2E9E5B]";
  if (status === "scheduled") return "bg-[#FBF0E1] text-[#9A5A16]";
  if (status === "editing" || status === "ready" || status === "saved") return "bg-[#F1EAFB] text-[#4B2E83]";
  return "bg-[#F2F1F6] text-[#6E6B80]";
}

function getPostCategory(post: SocialPostRow): PostCategory {
  if (hasPublicationStarted(post) || post.status === "published") return "published";
  if (post.status === "scheduled") return "scheduled";
  return "draft";
}

function getVisiblePostStatus(post: SocialPostRow, currentTime: number) {
  if (isPublicationPending(post, currentTime)) return "En cours de publication…";
  if (hasPublicationStarted(post) || post.status === "published") return "Publié";
  if (post.status === "draft" || post.status === "exported") return "Brouillon";
  return getPostStatusLabel(post.status);
}

function hasPublicationStarted(post: SocialPostRow) {
  return Boolean(post.published_at);
}

function hasFinalPng(post: SocialPostRow) {
  return post.visual_html === "atrium-final-png-v1" && Boolean(post.visual_url);
}

function buildEditorActionHref(postId: string, action: "download" | "publish" | "schedule", scheduledAt?: string) {
  const params = new URLSearchParams({ action });
  if (scheduledAt) params.set("scheduledAt", scheduledAt);
  return `/social/editor/${postId}?${params.toString()}`;
}

function isPublicationPending(post: SocialPostRow, currentTime: number) {
  return hasPublicationStarted(post) && new Date(post.published_at!).getTime() > currentTime;
}

function getEmptyPostCategoryMessage(category: PostCategory) {
  if (category === "scheduled") return "Aucun post planifié pour le moment.";
  if (category === "published") return "Aucun post publié pour le moment.";
  return "Aucun brouillon pour le moment. Hans vous aidera à créer votre prochain post.";
}

function mapInstagramConnectionMessage({
  state,
  rawError,
  connectionError,
  configured
}: {
  state: InstagramOnboardingState;
  rawError: string | null;
  connectionError: string | null;
  configured: boolean;
}) {
  const source = `${rawError ?? ""} ${connectionError ?? ""}`.trim().toLowerCase();

  if (!configured || source.includes("instagram_unavailable") || source.includes("non configur")) {
    return "La connexion Instagram est temporairement indisponible.";
  }

  if (source.includes("expired") || source.includes("token") && source.includes("expir")) {
    return "Votre connexion Instagram doit être renouvelée.";
  }

  if (source.includes("access_denied") || source.includes("permission") || source.includes("autorisation")) {
    return "Certaines autorisations nécessaires n’ont pas été accordées.";
  }

  if (source.includes("professionnel") || source.includes("professional") || source.includes("page facebook") || source.includes("aucun compte instagram professionnel")) {
    return "Passez votre compte Instagram en compte professionnel.";
  }

  if (state === "pending_configuration") {
    return "Passez votre compte Instagram en compte professionnel puis reliez-le à une Page Facebook pour terminer la connexion.";
  }

  if (state === "action_required") {
    return "Certaines autorisations nécessaires n’ont pas encore été accordées. Reprenez la connexion pour finaliser l’accès.";
  }

  if (state === "error") {
    return "La connexion Instagram nécessite une vérification. Réessayez ou changez de compte.";
  }

  if (state === "connected") {
    return "Votre compte Instagram est prêt. Vous pouvez publier, planifier et reprendre vos brouillons depuis Atrium One.";
  }

  if (state === "connecting") {
    return "Redirection sécurisée vers Instagram…";
  }

  return "Publiez et planifiez vos contenus directement depuis Atrium One.";
}

function isInstagramActionRequiredError(error: string) {
  const value = error.toLowerCase();
  return value.includes("access_denied") || value.includes("permission") || value.includes("autorisation");
}

function getInstagramStatusLabel(state: InstagramOnboardingState) {
  if (state === "connected") return "Connecté";
  if (state === "connecting") return "Connexion en cours";
  if (state === "pending_configuration") return "Action requise";
  if (state === "action_required") return "Action requise";
  if (state === "error") return "À vérifier";
  return "Non connecté";
}

function getInstagramInitials(value: string) {
  const clean = value.replace(/^@/, "").trim();
  if (!clean) return "IG";
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "I") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "G");
}
