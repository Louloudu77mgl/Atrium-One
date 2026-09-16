"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CrmReleaseRow, CrmReleaseSendRow } from "@/lib/supabase/types";

type FormState = { title: string; version: string; releaseDate: string; summary: string; description: string; highlights: string; improvements: string; fixes: string; category: string; status: "draft" | "published"; emailSubject: string; emailIntro: string };
const blank = (): FormState => ({ title: "", version: "", releaseDate: new Date().toISOString().slice(0, 10), summary: "", description: "", highlights: "", improvements: "", fixes: "", category: "Produit", status: "draft", emailSubject: "", emailIntro: "" });
const jsonList = (value: CrmReleaseRow["highlights"]) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const fromRelease = (release: CrmReleaseRow): FormState => ({ title: release.title, version: release.version ?? "", releaseDate: release.release_date, summary: release.summary, description: release.description, highlights: jsonList(release.highlights).join("\n"), improvements: jsonList(release.improvements).join("\n"), fixes: jsonList(release.fixes).join("\n"), category: release.category, status: release.status, emailSubject: release.email_subject ?? "", emailIntro: release.email_intro ?? "" });

export function ReleasesClient({ initialReleases, initialSends }: { initialReleases: CrmReleaseRow[]; initialSends: CrmReleaseSendRow[] }) {
  const router = useRouter();
  const [releases, setReleases] = useState(initialReleases);
  const [sends, setSends] = useState(initialSends);
  const [selectedId, setSelectedId] = useState<string | null>(initialReleases[0]?.id ?? null);
  const selected = releases.find((release) => release.id === selectedId) ?? null;
  const [form, setForm] = useState<FormState>(() => selected ? fromRelease(selected) : blank());
  const [isNew, setIsNew] = useState(!selected);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ html: string; audienceCount: number; gmailConnected: boolean; gmailAddress: string | null; subject: string } | null>(null);
  const sendHistory = useMemo(() => selected ? sends.filter((send) => send.release_id === selected.id).slice(0, 5) : [], [sends, selected]);
  const lastSend = sendHistory[0] ?? null;
  const payload = () => ({ ...form, highlights: form.highlights.split("\n").map((v) => v.trim()).filter(Boolean), improvements: form.improvements.split("\n").map((v) => v.trim()).filter(Boolean), fixes: form.fixes.split("\n").map((v) => v.trim()).filter(Boolean) });

  async function save() {
    setBusy(true); setMessage(null);
    const response = await fetch(isNew ? "/api/crm/releases" : `/api/crm/releases/${selectedId}`, { method: isNew ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) });
    const body = await response.json();
    if (!response.ok || !body.release) { setMessage(body.error ?? "Enregistrement impossible."); setBusy(false); return; }
    setReleases((current) => [body.release, ...current.filter((release) => release.id !== body.release.id)].sort((a, b) => b.release_date.localeCompare(a.release_date)));
    setSelectedId(body.release.id); setForm(fromRelease(body.release)); setIsNew(false); setMessage("Release enregistrée."); setBusy(false);
  }

  async function openPreview() {
    if (isNew) { setMessage("Enregistrez la release avant la prévisualisation."); return; }
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/crm/releases/${selectedId}/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: form.emailSubject, intro: form.emailIntro }) });
    const body = await response.json();
    if (!response.ok) setMessage(body.error ?? "Prévisualisation impossible."); else setPreview(body);
    setBusy(false);
  }

  async function send() {
    if (!preview || !selectedId || !window.confirm(`Envoyer cette release à ${preview.audienceCount} utilisateur${preview.audienceCount > 1 ? "s" : ""} actif${preview.audienceCount > 1 ? "s" : ""} ?`)) return;
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/crm/releases/${selectedId}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true, subject: preview.subject, intro: form.emailIntro }) });
    const body = await response.json();
    if (!response.ok) setMessage(body.error ?? "Envoi impossible."); else {
      if (body.send) setSends((current) => [body.send, ...current.filter((item) => item.id !== body.send.id)]);
      setMessage(`${body.sentCount} e-mail${body.sentCount > 1 ? "s" : ""} envoyé${body.sentCount > 1 ? "s" : ""}${body.failedCount ? ` · ${body.failedCount} en échec` : ""}.`);
      setPreview(null);
      router.refresh();
    }
    setBusy(false);
  }

  function choose(release: CrmReleaseRow) { setSelectedId(release.id); setForm(fromRelease(release)); setIsNew(false); setPreview(null); setMessage(null); }
  const field = (key: keyof FormState, label: string, multiline = false) => <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-[#8B7AA8]">{label}</span>{multiline ? <textarea value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} rows={key === "description" ? 5 : 4} className="w-full rounded-xl border border-[#DDD6CC] px-3 py-2.5 text-sm outline-none focus:border-[#7C3AED]"/> : <input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-xl border border-[#DDD6CC] px-3 py-2.5 text-sm outline-none focus:border-[#7C3AED]"/>}</label>;

  return <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
    <aside className="self-start rounded-2xl border border-[#E8E4DB] bg-white p-4 shadow-sm"><button type="button" onClick={() => { setIsNew(true); setSelectedId(null); setForm(blank()); setPreview(null); }} className="w-full rounded-xl bg-[#211432] px-4 py-3 text-sm font-black text-white">+ Nouvelle release</button><div className="mt-4 space-y-2">{releases.map((release) => <button key={release.id} type="button" onClick={() => choose(release)} className={`w-full rounded-xl border p-3 text-left ${selectedId === release.id ? "border-[#A78BFA] bg-[#F8F5FF]" : "border-[#EEEAE2] hover:bg-[#FAF9F7]"}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase text-[#7C3AED]">{release.version ?? release.category}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${release.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{release.status === "published" ? "Publié" : "Brouillon"}</span></div><strong className="mt-2 block text-sm leading-5">{release.title}</strong><span className="mt-1 block text-[10px] font-bold text-[#8B7AA8]">{new Date(`${release.release_date}T12:00:00`).toLocaleDateString("fr-FR")}</span></button>)}</div></aside>
    <section className="rounded-2xl border border-[#E8E4DB] bg-white p-5 shadow-sm lg:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.12em] text-[#8B7AA8]">{isNew ? "Nouvelle entrée" : "Édition"}</div><h2 className="mt-1 text-xl font-black">{isNew ? "Créer une release" : selected?.title}</h2></div>{lastSend ? <span className="rounded-full bg-[#F1EEE8] px-3 py-1 text-[10px] font-black">Dernier envoi · {lastSend.sent_count}/{lastSend.audience_count}</span> : null}</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{field("title", "Titre")} {field("version", "Version")}<label><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-[#8B7AA8]">Date</span><input type="date" value={form.releaseDate} onChange={(event) => setForm((c) => ({ ...c, releaseDate: event.target.value }))} className="w-full rounded-xl border border-[#DDD6CC] px-3 py-2.5 text-sm"/></label>{field("category", "Catégorie")}</div>
      <div className="mt-4 space-y-4">{field("summary", "Résumé", true)}{field("description", "Description", true)}<div className="grid gap-4 lg:grid-cols-3">{field("highlights", "Nouveautés · une par ligne", true)}{field("improvements", "Améliorations · une par ligne", true)}{field("fixes", "Corrections · une par ligne", true)}</div><div className="grid gap-4 sm:grid-cols-2">{field("emailSubject", "Objet de l’e-mail")}{field("emailIntro", "Introduction e-mail", true)}</div><label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-[#8B7AA8]">Statut</span><select value={form.status} onChange={(event) => setForm((c) => ({ ...c, status: event.target.value as FormState["status"] }))} className="rounded-xl border border-[#DDD6CC] px-3 py-2.5 text-sm font-bold"><option value="draft">Brouillon</option><option value="published">Publié</option></select></label></div>
      {message ? <p className="mt-4 rounded-xl bg-[#F8F5FF] px-4 py-3 text-sm font-bold text-[#4C1D95]">{message}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-[#EEEAE2] pt-5"><button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg bg-[#211432] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">Enregistrer</button><button type="button" onClick={() => void openPreview()} disabled={busy || isNew} className="rounded-lg border border-[#C4B5FD] px-5 py-2.5 text-sm font-black text-[#6D28D9] disabled:opacity-40">Prévisualiser l’e-mail</button></div>
      {sendHistory.length ? <div className="mt-7 border-t border-[#EEEAE2] pt-5"><h3 className="text-xs font-black uppercase tracking-wide text-[#8B7AA8]">Historique des envois</h3><div className="mt-3 space-y-2">{sendHistory.map((sendItem) => <div key={sendItem.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF9F7] px-4 py-3 text-xs"><span className="font-bold text-[#4F4858]">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sendItem.created_at))}</span><span className="font-black text-[#6D28D9]">{sendItem.sent_count}/{sendItem.audience_count} envoyé{sendItem.sent_count > 1 ? "s" : ""} · {sendItem.status}</span></div>)}</div></div> : null}
    </section>
    {preview ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#150B20]/65 p-4" onClick={() => setPreview(null)}><div className="flex h-[94vh] max-h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEEAE2] px-5 py-4"><div><h3 className="font-black">Prévisualisation avant envoi</h3><p className="mt-1 text-xs font-bold text-[#6B617F]">{preview.audienceCount} destinataire{preview.audienceCount > 1 ? "s" : ""} actif{preview.audienceCount > 1 ? "s" : ""} · {preview.gmailConnected ? preview.gmailAddress : "Gmail non connecté"}</p></div><button onClick={() => setPreview(null)} className="text-xl">×</button></div><iframe title="Aperçu de l’e-mail release" sandbox="" srcDoc={preview.html} className="min-h-0 flex-1 bg-[#F5F2F8]"/><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEEAE2] px-5 py-4">{preview.gmailConnected ? <p className="text-xs font-bold text-emerald-700">Prêt à envoyer depuis {preview.gmailAddress}</p> : <a href="/crm/settings" className="text-xs font-black text-red-700">Connecter Gmail dans Réglages</a>}<button type="button" onClick={() => void send()} disabled={busy || !preview.gmailConnected || preview.audienceCount === 0} className="rounded-lg bg-[#6D28D9] px-5 py-2.5 text-sm font-black text-white disabled:opacity-40">Envoyer aux utilisateurs actifs</button></div></div></div> : null}
  </div>;
}
