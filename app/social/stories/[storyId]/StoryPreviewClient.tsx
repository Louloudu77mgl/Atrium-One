"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SocialPostRow } from "@/lib/supabase/types";
import { getPostStatusLabel } from "@/lib/social-post-utils";

export function StoryPreviewClient({ story }: { story: SocialPostRow }) {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (!story.scheduled_at) return "";
    const date = new Date(story.scheduled_at);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(story.error_message);
  const [diagnostic, setDiagnostic] = useState<{ message: string; eligible: boolean } | null>(null);
  useEffect(() => setError(story.error_message), [story.error_message]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Une erreur est survenue. Réessayez."); }
    finally { setBusy(false); }
  }
  async function publish() {
    await run(async () => {
    const response = await fetch(`/api/social/posts/${story.id}/publish-instagram`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) { router.refresh(); throw new Error(body.error ?? "Publication impossible."); }
    router.refresh();
    });
  }
  async function schedule() {
    if (!scheduledAt) return;
    await run(async () => {
    const response = await fetch(`/api/social/posts/${story.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "scheduled", scheduled_at: new Date(scheduledAt).toISOString() }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Planification impossible.");
    router.refresh();
    });
  }
  async function checkAccount() {
    await run(async () => {
      const response = await fetch("/api/instagram/test", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Vérification impossible. Consultez la page Intégrations.");
      setDiagnostic({ message: [body.username ? `@${body.username}` : null, body.storyMessage].filter(Boolean).join(" — "), eligible: body.storyEligible === true });
    });
  }
  async function download() {
    await run(async () => {
      const url = story.visual_url ?? story.image_url;
      if (!url) throw new Error("Le visuel n’est pas disponible.");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Téléchargement impossible. Réessayez.");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl; link.download = `story-${story.id}.jpg`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    });
  }
  return <div className="mx-auto max-w-[980px] pb-20">
    <Link href="/social" className="mb-5 inline-flex text-[13px] font-semibold text-[#5B2A9E] hover:underline">← Retour à Instagram</Link>
    <div className="grid gap-7 lg:grid-cols-[380px_1fr]">
      <div className="rounded-[26px] bg-[#17101F] p-3 shadow-[0_20px_50px_rgba(24,12,48,.2)]"><img src={story.visual_url ?? story.image_url ?? ""} alt={story.title} className="aspect-[9/16] w-full rounded-[18px] object-contain" /></div>
      <section className="self-start rounded-[22px] border border-[#ECE9F4] bg-white p-7 shadow-sm">
        <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#F1EAFB] px-3 py-1 text-xs font-bold text-[#5B2A9E]">Story Instagram</span><span className="text-xs font-bold text-[#6E6B80]">{getPostStatusLabel(story.status)}</span></div>
        <h1 className="mt-5 text-2xl font-extrabold text-[#1E1B2E]">{story.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#6E6B80]">{story.caption}</p>
        {story.scheduled_at ? <p className="mt-4 rounded-xl bg-[#F5F0FF] px-4 py-3 text-xs font-semibold text-[#5B2A9E]">Publication prévue le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(story.scheduled_at))}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-[#FEF2F2] px-4 py-3 text-xs font-semibold text-[#B4233C]">{error}</p> : null}
        {story.status !== "published" && story.status !== "publishing" ? <div className="mt-7 border-t border-[#EEE9F5] pt-6">
          <button type="button" onClick={() => void publish()} disabled={busy || diagnostic?.eligible === false} className="w-full rounded-full bg-[#2B1A4A] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{story.status === "failed" ? "Réessayer la publication" : "Publier maintenant"}</button>
          <div className="mt-4 flex gap-2"><input aria-label="Date et heure de publication" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="min-w-0 flex-1 rounded-full border border-[#D8CAEE] px-4 py-2.5 text-xs"/><button type="button" onClick={() => void schedule()} disabled={!scheduledAt || busy || diagnostic?.eligible === false} className="rounded-full border border-[#D8CAEE] px-4 py-2 text-xs font-bold text-[#5B2A9E]">Planifier</button></div>
        </div> : null}
        <div className="mt-6 space-y-3 border-t border-[#EEE9F5] pt-5 text-xs leading-5 text-[#6E6B80]">
          <button type="button" onClick={() => void checkAccount()} disabled={busy} className="font-bold text-[#5B2A9E] disabled:opacity-50">Vérifier mon compte Instagram</button>
          {diagnostic ? <p role="status" className="rounded-xl bg-[#F5F0FF] p-3">{diagnostic.message}</p> : null}
          <p>Un blocage Meta ? Vérifiez votre compte et ses autorisations dans <Link href="/integrations" className="font-semibold underline">Intégrations</Link> ou <a href="https://www.instagram.com/accounts/manage_access/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">gérez l’accès AtriumOne sur Instagram</a>.</p>
          <button type="button" onClick={() => void download()} disabled={busy} className="w-full rounded-full border border-[#D8CAEE] px-4 py-3 font-bold text-[#5B2A9E] disabled:opacity-50">Télécharger la Story · 1080 × 1920</button>
          <p>Vous pouvez aussi ajouter ce fichier à votre Story depuis l’application Instagram. Le téléchargement ne publie rien et ne change pas son statut dans AtriumOne.</p>
        </div>
      </section>
    </div>
  </div>;
}
