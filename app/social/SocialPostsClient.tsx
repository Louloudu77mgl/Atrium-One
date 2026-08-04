"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getPostStatusLabel } from "@/lib/social-post-utils";
import type { SocialPostRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";

export function SocialPostsClient({ initialPosts, instagramConnected }: { initialPosts: SocialPostRow[]; instagramConnected: boolean }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleValues, setScheduleValues] = useState<Record<string, string>>({});
  const { toast, showToast } = useToast();
  const orderedPosts = useMemo(
    () => posts.slice().sort((left, right) => new Date(right.scheduled_at ?? right.updated_at).getTime() - new Date(left.scheduled_at ?? left.updated_at).getTime()),
    [posts]
  );

  async function deletePost(postId: string) {
    if (busyId === postId) return;
    setBusyId(postId);
    try {
      const response = await fetchWithTimeout(`/api/social/posts/${postId}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Suppression impossible.");
      setPosts((current) => current.filter((post) => post.id !== postId));
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
      const data = await response.json() as { post?: SocialPostRow; error?: string };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Publication impossible.");
      setPosts((current) => current.map((post) => post.id === postId ? data.post! : post));
      showToast("Post publié sur Instagram", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Publication impossible."), "error");
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

    if (busyId === postId) return;
    setBusyId(postId);
    try {
      const response = await fetchWithTimeout(`/api/social/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          scheduled_at: new Date(value).toISOString(),
          error_message: null
        })
      });
      const data = await response.json() as { post?: SocialPostRow; error?: string };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Planification impossible.");
      setPosts((current) => current.map((post) => post.id === postId ? data.post! : post));
      showToast("Post planifié", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Planification impossible."), "error");
    } finally {
      setBusyId(null);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-[#D8B4FE] bg-white p-6 text-sm text-[#6B617F]">
        Aucun brouillon pour le moment. Hans vous aidera à créer vos premiers posts dès qu’une idée est prête.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[22px] border border-[#E9D5FF] bg-white shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
        <div className="hidden grid-cols-[150px_72px_1fr_120px_250px] gap-4 border-b border-[#F1EAFE] bg-[#FBFAFF] px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#8B7AA8] lg:grid">
          <div>Date prévue</div>
          <div>Visuel</div>
          <div>Post</div>
          <div>Statut</div>
          <div>Action</div>
        </div>
        {orderedPosts.map((post) => (
          <article
            key={post.id}
            onClick={() => router.push(`/social/editor/${post.id}`)}
            className="grid cursor-pointer gap-4 border-b border-[#F5F0FF] px-5 py-4 transition hover:bg-[#FCFBFF] last:border-b-0 lg:grid-cols-[150px_72px_1fr_120px_250px] lg:items-center"
          >
            <div className="text-sm font-semibold text-[#6B617F]">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8B7AA8] lg:hidden">Date prévue</div>
              {post.scheduled_at
                ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.scheduled_at))
                : "Non planifié"}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8B7AA8] lg:hidden">Visuel</div>
              {post.visual_url || post.image_url ? (
                <img src={post.visual_url ?? post.image_url ?? ""} alt={post.title} className="mt-1 h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="mt-1 flex h-16 w-16 items-center justify-center rounded-xl bg-[#F3E8FF] text-[11px] font-black text-[#7C3AED]">À créer</div>
              )}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8B7AA8] lg:hidden">Post</div>
              <h3 className="text-sm font-black text-[#211432]">{post.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#6B617F]">{post.caption}</p>
              {post.error_message ? <p className="mt-1 text-xs font-semibold text-[#B91C1C]">{post.error_message}</p> : null}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8B7AA8] lg:hidden">Statut</div>
              <span className="mt-1 inline-flex rounded-full bg-[#FBFAFF] px-3 py-1 text-xs font-bold text-[#6B617F]">
                {post.status === "draft" ? "Brouillon" : getPostStatusLabel(post.status)}
              </span>
            </div>
            <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8B7AA8] lg:hidden">Action</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void publishPost(post.id)} disabled={busyId === post.id || !instagramConnected || post.status === "published"} className="rounded-xl bg-[#A855F7] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  Publier maintenant
                </button>
                <button type="button" onClick={() => router.push(`/social/editor/${post.id}`)} className="rounded-xl bg-[#F3E8FF] px-3 py-2 text-sm font-bold text-[#4C1D95]">
                  Ouvrir
                </button>
                <button type="button" onClick={() => void deletePost(post.id)} disabled={busyId === post.id} className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm font-bold text-[#DC2626] disabled:opacity-50">
                  Supprimer
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="datetime-local"
                  value={scheduleValues[post.id] ?? ""}
                  onChange={(event) => setScheduleValues((current) => ({ ...current, [post.id]: event.target.value }))}
                  className="rounded-xl border border-[#E9D5FF] px-3 py-2 text-sm text-[#211432] outline-none"
                />
                <button type="button" onClick={() => void schedulePost(post.id)} disabled={busyId === post.id} className="rounded-xl bg-[#F3E8FF] px-3 py-2 text-sm font-bold text-[#4C1D95] disabled:opacity-50">
                  Planifier
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Toast toast={toast} />
    </>
  );
}
