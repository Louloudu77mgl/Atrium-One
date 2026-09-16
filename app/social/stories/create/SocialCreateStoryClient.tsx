"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HansGeneratingModal } from "@/components/HansGeneratingModal";
import type { DraftIdeaInput } from "@/lib/social-drafts";

export function SocialCreateStoryClient({ initialIdea = null }: { initialIdea?: DraftIdeaInput | null }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialIdea?.angle ?? "");
  const [mode, setMode] = useState<"draft" | "schedule" | "now">("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!prompt.trim() || creating) return;
    setCreating(true); setError(null);
    try {
      const response = await fetch("/api/social/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idea: {
            ...initialIdea,
            platform: "instagram",
            contentType: "story",
            title: initialIdea?.title ?? prompt.trim().slice(0, 64),
            angle: prompt.trim(),
            source: initialIdea?.source ?? "Demande du commerçant"
          },
          scheduledAt: mode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          publishNow: mode === "now"
        })
      });
      const body = await response.json();
      if (!response.ok || !body.story) throw new Error(body.error ?? "Création impossible.");
      router.push(`/social/stories/${body.story.id}`);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Création impossible.");
      setCreating(false);
    }
  }

  return <div className="mx-auto max-w-[980px] pb-20">
    <Link href="/social" className="mb-5 inline-flex text-[13px] font-semibold text-[#5B2A9E] hover:underline">← Retour à Instagram</Link>
    <section className="overflow-hidden rounded-[24px] border border-[#ECE9F4] bg-white shadow-[0_12px_36px_rgba(24,12,48,.07)]">
      <div className="bg-[linear-gradient(135deg,#FBF8FF,#F0E7FF_55%,#FFF5EC)] px-7 py-8 sm:px-9">
        <p className="text-[11px] font-bold uppercase tracking-[.09em] text-[#6E4DE0]">Story Instagram · 9:16</p>
        <h1 className="mt-2 text-[27px] font-extrabold tracking-[-.02em] text-[#1E1B2E]">Une Story pensée par Hans, prête à publier.</h1>
        <p className="mt-2 max-w-[680px] text-sm leading-6 text-[#6E6B80]">Décrivez le message. Hans choisit la photo pertinente, applique votre charte et compose un visuel vertical 1080 × 1920.</p>
      </div>
      <div className="grid gap-7 p-7 lg:grid-cols-[1fr_300px] sm:p-9">
        <div>
          <label htmlFor="story-prompt" className="text-sm font-bold text-[#1E1B2E]">Que voulez-vous raconter ?</label>
          <textarea id="story-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={600} rows={7} placeholder="Exemple : présente notre nouveau soin du visage avec une ambiance douce et un appel à prendre rendez-vous." className="mt-3 w-full resize-none rounded-[18px] border border-[#DDD6E7] bg-[#FCFBFD] px-4 py-4 text-sm leading-6 outline-none focus:border-[#7C4DCB] focus:ring-4 focus:ring-[#7C4DCB]/10" />
          <p className="mt-2 text-right text-xs text-[#8F8998]">{prompt.length}/600</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {([
              ["draft", "Prévisualiser", "Créer sans publier"],
              ["schedule", "Planifier", "Choisir une date"],
              ["now", "Publier maintenant", "Compte Business requis"]
            ] as const).map(([value, title, detail]) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-[15px] border p-4 text-left ${mode === value ? "border-[#6E4DE0] bg-[#F6F1FF]" : "border-[#E9E4F0]"}`}><strong className="block text-xs text-[#1E1B2E]">{title}</strong><span className="mt-1 block text-[11px] text-[#777287]">{detail}</span></button>)}
          </div>
          {mode === "schedule" ? <div className="mt-4"><label className="mb-2 block text-xs font-bold text-[#6E6B80]">Date et heure de publication</label><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)} className="rounded-full border border-[#D8CAEE] px-4 py-2.5 text-sm" /></div> : null}
          {error ? <p className="mt-4 rounded-xl bg-[#FEF2F2] px-4 py-3 text-xs font-semibold text-[#B4233C]">{error}</p> : null}
          <button type="button" onClick={() => void create()} disabled={!prompt.trim() || creating || (mode === "schedule" && !scheduledAt)} className="mt-6 inline-flex min-w-[220px] justify-center rounded-full bg-[linear-gradient(135deg,#4B2E83,#7C4DCB)] px-6 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-45">{creating ? "Hans compose la Story…" : mode === "now" ? "Créer et publier" : mode === "schedule" ? "Créer et planifier" : "Créer la Story"}</button>
        </div>
        <div className="rounded-[22px] bg-[#17101F] p-3 shadow-[0_18px_40px_rgba(24,12,48,.18)]">
          <div className="aspect-[9/16] overflow-hidden rounded-[16px] bg-[#F5F0E8] px-5 py-12 text-[#2C2430]">
            <p className="border-b border-[#DDD3C5] pb-3 text-[9px] font-bold">Votre commerce</p>
            <p className="mt-4 text-[7px] uppercase tracking-widest">Le journal de votre marque</p>
            <strong className="mt-2 block font-serif text-[23px] font-normal leading-tight">Vos belles histoires commencent ici.</strong>
            <div className="mt-4 rounded-xl bg-white p-2 shadow-sm"><div className="flex h-24 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#DBC9AF,#F5EADC)] text-[9px] text-[#766451]">Votre photo, choisie par Hans</div><p className="px-2 py-3 font-serif text-xs">Un instant à partager</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#E8DDD0] p-3 font-serif text-[10px]">L’inspiration</div><div className="rounded-lg bg-[#E6E0E8] p-3 font-serif text-[10px]">Le sens du détail</div></div>
            <span className="mt-4 inline-flex rounded-full bg-[#514355] px-5 py-2 text-[8px] font-bold text-white">Venez nous rencontrer →</span>
          </div>
          <p className="px-2 pb-1 pt-3 text-center text-[10px] font-semibold text-white/65">Aperçu de composition · le visuel final sera personnalisé</p>
        </div>
      </div>
    </section>
    <HansGeneratingModal open={creating} title="Hans crée votre Story" description="Choix de la photo, composition 9:16 et application de votre identité visuelle." />
  </div>;
}
