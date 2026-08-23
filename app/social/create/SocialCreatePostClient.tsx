"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HansGeneratingModal } from "@/components/HansGeneratingModal";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import type { ReviewSocialPostIdea } from "@/lib/review-insights";
import { getUserErrorMessage } from "@/lib/user-feedback";

export function SocialCreatePostClient({
  ideas,
  initialIdea
}: {
  ideas: ReviewSocialPostIdea[];
  initialIdea: ReviewSocialPostIdea | null;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const recommendationIdeas = useMemo(() => {
    const candidates = initialIdea ? [initialIdea, ...ideas] : ideas;
    const unique = new Map<string, ReviewSocialPostIdea>();

    candidates.forEach((idea) => {
      const key = getIdeaKey(idea);
      if (!unique.has(key)) unique.set(key, { ...idea, platform: "instagram" });
    });

    return [...unique.values()].slice(0, 2);
  }, [ideas, initialIdea]);
  const [selectedKey, setSelectedKey] = useState(() => initialIdea ? getIdeaKey(initialIdea) : "");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const selectedIdea = recommendationIdeas.find((idea) => getIdeaKey(idea) === selectedKey) ?? null;
  const canCreate = Boolean(selectedIdea || prompt.trim());

  async function createPost() {
    if (creating || !canCreate) return;

    setCreating(true);
    showToast("Hans prépare votre post et son image…", "saving");

    const customPrompt = prompt.trim();
    const payload = selectedIdea
      ? {
          platform: "instagram",
          title: selectedIdea.title,
          angle: selectedIdea.angle,
          source: selectedIdea.sourcePainPoint ?? selectedIdea.sourceStrength ?? selectedIdea.seasonalMoment ?? "Recommandation Hans",
          category: selectedIdea.category,
          seasonalMoment: selectedIdea.seasonalMoment
        }
      : {
          platform: "instagram",
          title: customPrompt.slice(0, 64) || "Votre idée de post",
          angle: customPrompt,
          source: "Demande du commerçant"
        };

    try {
      const response = await fetch("/api/social/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { post?: { id: string }; error?: string };

      if (!response.ok || !data.post) {
        throw new Error(data.error ?? "Création du post impossible.");
      }

      router.push(`/social/editor/${data.post.id}`);
    } catch (error) {
      setCreating(false);
      showToast(getUserErrorMessage(error, "Hans n’a pas pu créer le post. Réessayez dans quelques instants."), "error");
    }
  }

  return (
    <div className="mx-auto max-w-[980px] px-6 pb-20 pt-8">
      <Link href="/social" className="mb-5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#5B2A9E] hover:underline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Retour à Instagram
      </Link>

      <section className="overflow-hidden rounded-[24px] border border-[#ECE9F4] bg-white shadow-[0_1px_2px_rgba(24,12,48,0.04),0_12px_36px_rgba(24,12,48,0.07)]">
        <div className="border-b border-[#EEE9F5] bg-[linear-gradient(135deg,#FBF8FF_0%,#F3ECFF_55%,#FFF8F1_100%)] px-6 py-7 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#4B2E83,#8B5FD3)] text-white shadow-[0_8px_22px_rgba(75,46,131,0.24)]">
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 9.8 8.8 4 11l5.8 2.2L12 19l2.2-5.8L20 11l-5.8-2.2L12 3Z" /></svg>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.09em] text-[#5B2A9E]">Création avec Hans</p>
              <h1 className="text-[25px] font-extrabold tracking-[-0.02em] text-[#1E1B2E]">Quel post voulez-vous créer ?</h1>
              <p className="mt-1 text-[14px] leading-[1.55] text-[#6E6B80]">Choisissez une idée de Hans ou décrivez simplement ce que vous avez en tête.</p>
            </div>
          </div>
        </div>

        <div className="space-y-7 p-6 sm:p-8">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#5B2A9E]">Les recommandations de Hans</p>
                <p className="mt-1 text-[13px] text-[#777287]">Sélectionnez l’idée qui vous convient.</p>
              </div>
              <span className="rounded-full bg-[#F1EAFB] px-3 py-1 text-[11.5px] font-semibold text-[#4B2E83]">2 idées maximum</span>
            </div>

            {recommendationIdeas.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {recommendationIdeas.map((idea) => {
                  const key = getIdeaKey(idea);
                  const selected = key === selectedKey;
                  const source = idea.sourcePainPoint ?? idea.sourceStrength ?? idea.seasonalMoment ?? "Votre activité";

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedKey(key);
                        setPrompt("");
                      }}
                      className={`flex min-h-[188px] flex-col rounded-[20px] border p-5 text-left transition ${selected ? "border-[#7C4DCB] bg-[#F8F3FF] shadow-[0_10px_26px_rgba(75,46,131,0.12)]" : "border-[#E9E4F0] bg-white hover:border-[#CDB9EB] hover:shadow-[0_8px_22px_rgba(75,46,131,0.08)]"}`}
                    >
                      <div className="mb-4 flex w-full items-center justify-between gap-3">
                        <span className="rounded-full bg-[#EEE6FA] px-3 py-1 text-[11.5px] font-semibold text-[#4B2E83]">Hans recommande</span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-[#6D3FC0] bg-[#6D3FC0] text-white" : "border-[#D8D1E2] bg-white text-transparent"}`}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
                        </span>
                      </div>
                      <h2 className="text-[16px] font-extrabold leading-[1.35] text-[#1E1B2E]">{idea.title}</h2>
                      <p className="mt-2 flex-1 text-[13px] leading-[1.55] text-[#6E6B80]">{idea.angle}</p>
                      <p className="mt-4 text-[11.5px] font-semibold text-[#8B7AA8]">Inspiré par : {source}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-[#DCD3E8] bg-[#FBFAFD] p-5 text-[13px] leading-[1.55] text-[#6E6B80]">
                Hans n’a pas encore assez d’avis pour proposer des recommandations. Vous pouvez tout de même lui décrire votre idée ci-dessous.
              </div>
            )}
          </div>

          <div className="flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-[#ECE7F1]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#A09AAA]">ou</span>
            <span className="h-px flex-1 bg-[#ECE7F1]" />
          </div>

          <div>
            <label htmlFor="hans-post-prompt" className="text-[14px] font-bold text-[#1E1B2E]">Décrivez votre propre idée à Hans</label>
            <p className="mt-1 text-[12.5px] text-[#777287]">Parlez-lui comme à une personne : sujet, ambiance, offre ou actualité à mettre en avant.</p>
            <textarea
              id="hans-post-prompt"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                if (event.target.value.trim()) setSelectedKey("");
              }}
              maxLength={600}
              rows={5}
              placeholder="Exemple : crée un post chaleureux pour annoncer notre nouvelle collection de printemps, avec une image colorée et élégante."
              className="mt-3 w-full resize-none rounded-[18px] border border-[#DDD6E7] bg-[#FCFBFD] px-4 py-4 text-[14px] leading-[1.6] text-[#1E1B2E] outline-none transition placeholder:text-[#AAA4B3] focus:border-[#7C4DCB] focus:bg-white focus:ring-4 focus:ring-[#7C4DCB]/10"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-[11.5px] text-[#8F8998]">
              <span>Hans générera toujours une nouvelle image pour ce post.</span>
              <span>{prompt.length}/600</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#EEE9F5] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[500px] text-[12.5px] leading-[1.5] text-[#777287]">Vous pourrez modifier le texte et le visuel avant de publier.</p>
            <button
              type="button"
              onClick={() => void createPost()}
              disabled={!canCreate || creating}
              className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-6 py-3 text-[13.5px] font-semibold text-white shadow-[0_7px_20px_rgba(75,46,131,0.28)] transition hover:shadow-[0_9px_24px_rgba(75,46,131,0.36)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {creating ? "Hans prépare le post…" : "Créer le post avec Hans"}
            </button>
          </div>
        </div>
      </section>

      <Toast toast={toast} />
      <HansGeneratingModal
        open={creating}
        title="Hans crée votre post"
        description="Hans prépare la légende et génère une image originale avant d’ouvrir l’éditeur."
      />
    </div>
  );
}

function getIdeaKey(idea: ReviewSocialPostIdea) {
  return `${idea.title.trim().toLowerCase()}-${idea.angle.trim().toLowerCase()}`;
}
