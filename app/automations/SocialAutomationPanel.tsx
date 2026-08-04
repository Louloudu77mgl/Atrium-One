"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MerchantAutomationSettingsRow, SocialPostRow } from "@/lib/supabase/types";
import { getRecommendedPublishingSentence, getMaxPostsForCycle } from "@/lib/social-automation-shared";

const cardClass = "rounded-[20px] border border-[#EBE6DF] bg-white shadow-[0_1px_2px_rgba(23,19,31,0.03),0_6px_18px_rgba(23,19,31,0.04)]";
const subCardClass = "rounded-[12px] border border-[#EBE6DF] bg-[#F6F3EF] p-[20px_22px]";
const inputClass = "w-full rounded-[12px] border border-[#EBE6DF] bg-white px-4 py-[11px] text-center text-[13.5px] font-bold text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0]";

export function SocialAutomationPanel({
  initialSettings,
  initialPosts,
  businessType
}: {
  initialSettings: MerchantAutomationSettingsRow | null;
  initialPosts: SocialPostRow[];
  businessType?: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialSettings?.social_auto_publish_enabled ?? false);
  const [livePublish, setLivePublish] = useState(initialSettings?.social_auto_publish_live ?? false);
  const [cycleWeeks, setCycleWeeks] = useState(initialSettings?.social_cycle_weeks ?? 1);
  const [postsPerCycle, setPostsPerCycle] = useState(initialSettings?.social_posts_per_cycle ?? 1);
  const [posts, setPosts] = useState(initialPosts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxPosts = useMemo(() => getMaxPostsForCycle(cycleWeeks), [cycleWeeks]);
  const normalizedPostsPerCycle = Math.min(postsPerCycle, maxPosts);
  const rhythmSentence = `Hans créera ${normalizedPostsPerCycle} publication${normalizedPostsPerCycle > 1 ? "s" : ""} toutes les ${cycleWeeks} semaine${cycleWeeks > 1 ? "s" : ""}.`;
  const recommendationSentence = getRecommendedPublishingSentence(businessType, normalizedPostsPerCycle);
  const activeDays = getActiveDays(normalizedPostsPerCycle);
  const upcomingPosts = useMemo(
    () => posts.slice().sort((left, right) => new Date(left.scheduled_at ?? left.updated_at).getTime() - new Date(right.scheduled_at ?? right.updated_at).getTime()),
    [posts]
  );

  async function save(next?: Partial<{ enabled: boolean; livePublish: boolean; cycleWeeks: number; postsPerCycle: number }>) {
    const payload = {
      social_auto_publish_enabled: next?.enabled ?? enabled,
      social_auto_publish_live: next?.livePublish ?? livePublish,
      social_cycle_weeks: next?.cycleWeeks ?? cycleWeeks,
      social_posts_per_cycle: Math.min(next?.postsPerCycle ?? postsPerCycle, getMaxPostsForCycle(next?.cycleWeeks ?? cycleWeeks))
    };

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Impossible d’enregistrer.");
      }

      setEnabled(payload.social_auto_publish_enabled);
      setLivePublish(payload.social_auto_publish_live);
      setCycleWeeks(payload.social_cycle_weeks);
      setPostsPerCycle(payload.social_posts_per_cycle);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  async function movePost(postId: string, nextDate: string) {
    if (!nextDate) return;

    setSaving(true);
    setError(null);

    try {
      const scheduledAt = new Date(nextDate);
      scheduledAt.setHours(10, 0, 0, 0);
      const response = await fetch(`/api/social/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: scheduledAt.toISOString() })
      });
      const data = (await response.json()) as { post?: SocialPostRow; error?: string };
      if (!response.ok || !data.post) {
        throw new Error(data.error ?? "Impossible de déplacer la publication.");
      }
      setPosts((current) => current.map((post) => (post.id === postId ? data.post! : post)));
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Impossible de déplacer la publication.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass}>
      <div className="px-[30px] pb-1 pt-[26px]">
        <div className="flex items-start justify-between gap-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9A96A1]">Hans publie pour vous</span>
            <h1 className="mt-1 text-[22px] font-extrabold text-[#17131F]">Créer automatiquement des posts Instagram</h1>
            <p className="mt-1 text-[13.5px] text-[#6E6A76]">Hans prépare de vrais brouillons planifiés. Par défaut, vous validez avant publication.</p>
          </div>
          <label className="relative mt-1 inline-block h-6 w-[42px] shrink-0">
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={() => void save({ enabled: !enabled })}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full border border-[#EBE6DF] bg-[#F0EDEA] transition peer-checked:border-[#2B1A4A] peer-checked:bg-[#2B1A4A]" />
            <span className="absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition peer-checked:translate-x-[18px]" />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-[18px] px-[30px] py-[22px]">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className={subCardClass}>
            <h3 className="mb-[14px] text-[14.5px] font-extrabold text-[#17131F]">Choisir le rythme</h3>
            <div className="mb-[14px] grid gap-[14px] sm:grid-cols-2">
              <div>
                <label className="mb-[6px] block text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#9A96A1]">Publications</label>
                <input
                  type="number"
                  min={1}
                  max={maxPosts}
                  value={normalizedPostsPerCycle}
                  disabled={!enabled || saving}
                  onChange={(event) => setPostsPerCycle(Math.min(Number(event.target.value) || 1, maxPosts))}
                  onBlur={() => void save({ postsPerCycle: normalizedPostsPerCycle })}
                  className={`${inputClass} disabled:opacity-50`}
                />
              </div>
              <div>
                <label className="mb-[6px] block text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#9A96A1]">Période en semaines</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={cycleWeeks}
                  disabled={!enabled || saving}
                  onChange={(event) => {
                    const nextWeeks = Math.min(12, Math.max(1, Number(event.target.value) || 1));
                    setCycleWeeks(nextWeeks);
                    setPostsPerCycle((current) => Math.min(current, getMaxPostsForCycle(nextWeeks)));
                  }}
                  onBlur={() => void save({ cycleWeeks, postsPerCycle: normalizedPostsPerCycle })}
                  className={`${inputClass} disabled:opacity-50`}
                />
              </div>
            </div>

            <div className="mb-[10px] rounded-[8px] bg-[#F1ECFB] px-[14px] py-3 text-[13px] font-bold text-[#6E4DE0]">{rhythmSentence}</div>

            <div className="mb-1 flex gap-[6px]">
              {Array.from({ length: 7 }).map((_, index) => (
                <i key={`dot-${index}`} className={`inline-block h-3 w-3 rounded-full border border-[#EBE6DF] ${index < normalizedPostsPerCycle ? "bg-[#2B1A4A] border-[#2B1A4A]" : "bg-[#F0EDEA]"}`} />
              ))}
            </div>
            <p className="mb-[18px] text-[11.5px] text-[#9A96A1]">
              {normalizedPostsPerCycle} publication{normalizedPostsPerCycle > 1 ? "s" : ""} sur {7 * cycleWeeks} jours possibles · maximum autorisé {maxPosts} / {cycleWeeks} semaine{cycleWeeks > 1 ? "s" : ""}.
            </p>

            <label className="flex items-start justify-between gap-[14px] rounded-[8px] border border-[#EBE6DF] bg-white px-4 py-[14px]">
              <div>
                <strong className="block text-[13px] font-bold text-[#17131F]">Valider les posts avant publication</strong>
                <span className="mt-1 block text-xs text-[#6E6A76]">Mode sécurisé recommandé pour garder le contrôle.</span>
              </div>
              <input
                type="checkbox"
                checked={!livePublish}
                disabled={!enabled || saving}
                onChange={(event) => void save({ livePublish: !event.target.checked })}
                className="mt-1 h-5 w-5 accent-[#2B1A4A]"
              />
            </label>
          </div>

          <div className={subCardClass}>
            <h3 className="mb-[14px] text-[14.5px] font-extrabold text-[#17131F]">Aperçu de ce que Hans fait</h3>
            <div className="mb-[14px] flex flex-col">
              {[
                "Hans choisit des idées à partir de vos avis.",
                "Hans prépare les légendes et place les publications dans le calendrier.",
                "Vous validez les brouillons, ou Hans publie automatiquement si vous activez l’option avancée."
              ].map((step, index, array) => (
                <div key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#F1ECFB] text-[11px] font-extrabold text-[#6E4DE0]">{index + 1}</div>
                    {index < array.length - 1 ? <div className="my-[3px] w-px flex-1 bg-[#EBE6DF]" /> : null}
                  </div>
                  <div className="pb-4 text-[13px] leading-[1.5] text-[#17131F]">{step}</div>
                </div>
              ))}
            </div>

            <div className="mb-[10px] flex gap-2">
              {[
                ["L", "Lun"],
                ["M", "Mar"],
                ["M", "Mer"],
                ["J", "Jeu"],
                ["V", "Ven"],
                ["S", "Sam"],
                ["D", "Dim"]
              ].map(([shortLabel, label], index) => {
                const active = activeDays.includes(index);
                return (
                  <div key={`${shortLabel}-${label}-${index}`} className="flex flex-1 flex-col items-center gap-[6px]">
                    <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border text-[11.5px] font-bold ${active ? "border-[#2B1A4A] bg-[#2B1A4A] text-white" : "border-[#EBE6DF] bg-white text-[#9A96A1]"}`}>
                      {shortLabel}
                    </div>
                    <small className="text-[10px] text-[#9A96A1]">{label}</small>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-[10px] rounded-[8px] bg-[#F1ECFB] px-4 py-[14px] text-[13px] font-bold leading-[1.5] text-[#6E4DE0]">
              <svg viewBox="0 0 24 24" fill="none" className="mt-[2px] h-4 w-4 shrink-0"><path d="M12 4l2.5 3.5L19 4l-1 5.5c1 1 1.5 2.5 1.5 4 0 4-3.5 6.5-7.5 6.5S4.5 17.5 4.5 13.5c0-1.5.5-3 1.5-4L5 4l4.5 3.5L12 4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              <span>{recommendationSentence}</span>
            </div>

            {error ? <div className="mt-3 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#DC2626]">{error}</div> : null}
          </div>
        </div>

        <div>
          <h3 className="mb-1 mt-1 text-[14.5px] font-extrabold text-[#17131F]">Planning des brouillons</h3>
          <p className="mb-3 text-[13px] text-[#6E6A76]">Ajustez les prochaines dates de publication sans passer par un calendrier vide.</p>
          {upcomingPosts.length === 0 ? (
            <div className="flex flex-col items-center gap-[10px] rounded-[12px] border-[1.5px] border-dashed border-[#EBE6DF] bg-[#F6F3EF] p-[22px] text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#F1ECFB] text-[#6E4DE0]">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              </span>
              <p className="m-0 max-w-[40ch] text-[13px] text-[#6E6A76]">Activez l’automatisation pour que Hans crée ses premiers brouillons.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingPosts.map((post) => (
                <article key={post.id} className="grid gap-3 rounded-[12px] border border-[#EBE6DF] bg-[#F6F3EF] p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className={`inline-flex rounded-full px-[11px] py-1 text-[11.5px] font-semibold ${post.status === "scheduled" ? "bg-[#FBEED2] text-[#AD7A1E]" : "bg-[#F0EDEA] text-[#6E6A76]"}`}>
                      {post.status === "scheduled" ? "Programmée" : "Brouillon"}
                    </div>
                    <div className="mt-2 text-sm font-bold text-[#17131F]">{post.title}</div>
                    <div className="mt-1 text-sm text-[#6E6A76]">
                      {post.scheduled_at
                        ? `Prévue le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(post.scheduled_at))}`
                        : "Date à définir"}
                    </div>
                  </div>
                  <input
                    type="date"
                    className="w-full rounded-[12px] border border-[#EBE6DF] bg-white px-4 py-[11px] text-[13.5px] font-semibold text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0] md:w-[190px]"
                    defaultValue={post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 10) : ""}
                    onChange={(event) => void movePost(post.id, event.target.value)}
                  />
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getActiveDays(postsPerCycle: number) {
  const patterns = {
    1: [2],
    2: [1, 4],
    3: [1, 3, 5],
    4: [0, 2, 4, 5],
    5: [0, 1, 3, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6]
  } as Record<number, number[]>;

  return patterns[Math.max(1, Math.min(7, postsPerCycle))] ?? [1, 3, 5];
}
