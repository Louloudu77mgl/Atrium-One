"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { dedupeProspects } from "@/lib/crm/logic";
import type { PlacesProspect } from "@/lib/crm/types";

type SavedSearch = { id: string; city: string; business_type: string; result_count: number; google_result_count?: number; pages_fetched?: number; imported_count: number; results: PlacesProspect[]; next_page_token: string | null; created_at: string };

export function ProspectionWorkspace({ initialSearches }: { initialSearches: SavedSearch[] }) {
  const [searches, setSearches] = useState(initialSearches);
  const [city, setCity] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [results, setResults] = useState<PlacesProspect[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchId, setSearchId] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [googleCount, setGoogleCount] = useState(0);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [busy, setBusy] = useState<"search" | "more" | "import" | "delete" | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectable = useMemo(() => results.filter((item) => !item.alreadyExists), [results]);

  async function runSearch(loadMore = false, overrides?: { city: string; businessType: string }) {
    const nextCity = overrides?.city ?? city;
    const nextType = overrides?.businessType ?? businessType;
    if (!nextCity.trim() || !nextType.trim()) return setError("Renseignez une ville et un métier.");
    setBusy(loadMore ? "more" : "search"); setError(null); setNotice(null);
    setProgress(loadMore ? "Chargement de résultats supplémentaires..." : "Recherche Google en cours...");
    progressTimer.current = setTimeout(() => setProgress("Chargement de résultats supplémentaires..."), 1200);
    try {
      const response = await fetch("/api/crm/places/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city: nextCity, businessType: nextType, ...(loadMore ? { pageToken: nextPageToken, searchId } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Recherche impossible.");
      setCity(nextCity); setBusinessType(nextType);
      setResults((current) => loadMore ? dedupeProspects([...current, ...data.prospects]) : data.prospects);
      setSearchId(data.searchId); setNextPageToken(data.nextPageToken); setGoogleCount(data.googleResultCount); setUniqueCount(data.uniqueCount);
      if (!loadMore) setSelected(new Set());
      const saved: SavedSearch = { id: data.searchId, city: nextCity, business_type: nextType, result_count: data.uniqueCount, google_result_count: data.googleResultCount, pages_fetched: data.pagesFetched, imported_count: data.linkedCount, results: data.prospects, next_page_token: data.nextPageToken, created_at: new Date().toISOString() };
      setSearches((current) => loadMore ? current.map((item) => item.id === data.searchId ? { ...item, ...saved, results: dedupeProspects([...item.results, ...data.prospects]) } : item) : [saved, ...current]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Recherche impossible."); }
    finally { if (progressTimer.current) clearTimeout(progressTimer.current); setProgress(null); setBusy(null); }
  }

  function openSearch(search: SavedSearch) {
    setCity(search.city); setBusinessType(search.business_type); setResults(search.results ?? []); setSearchId(search.id); setNextPageToken(search.next_page_token);
    setGoogleCount(search.google_result_count ?? search.result_count); setUniqueCount(search.result_count); setSelected(new Set()); setError(null); setNotice(null);
  }

  async function deleteSearch(id: string) {
    if (!confirm("Supprimer cette card de recherche ?\n\nLes prospects déjà ajoutés à la Base de données seront conservés.")) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/crm/searches/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Suppression impossible.");
      setSearches((current) => current.filter((item) => item.id !== id));
      if (searchId === id) { setResults([]); setSearchId(null); setUniqueCount(0); setGoogleCount(0); }
      setNotice(`Recherche supprimée · ${data.deletedLeads ?? 0} prospect${data.deletedLeads === 1 ? "" : "s"} exclusivement associé${data.deletedLeads === 1 ? "" : "s"} supprimé${data.deletedLeads === 1 ? "" : "s"}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Suppression impossible."); }
    finally { setBusy(null); }
  }

  async function importSelection(ids?: string[]) {
    const chosen = results.filter((item) => (ids ? ids.includes(item.placeId) : selected.has(item.placeId)) && !item.alreadyExists);
    if (!chosen.length || !searchId) return;
    setBusy("import"); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/crm/places/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospects: chosen, searchId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Import impossible.");
      const links = new Map<string, string>([...(data.imported ?? []), ...(data.duplicates ?? [])].map((item: { placeId: string; leadId: string }) => [item.placeId, item.leadId]));
      setResults((current) => current.map((item) => links.has(item.placeId) ? { ...item, alreadyExists: true, existingLeadId: links.get(item.placeId)! } : item));
      setSelected(new Set());
      setSearches((current) => current.map((item) => item.id === searchId ? { ...item, imported_count: data.linkedCount } : item));
      setNotice(`${data.imported?.length ?? 0} prospect${data.imported?.length === 1 ? "" : "s"} ajouté${data.imported?.length === 1 ? "" : "s"} · ${data.duplicates?.length ?? 0} doublon${data.duplicates?.length === 1 ? "" : "s"} relié${data.duplicates?.length === 1 ? "" : "s"}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Import impossible."); }
    finally { setBusy(null); }
  }

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }

  return <div className="space-y-5 p-5 lg:p-8">
    <section className="rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="ao-label">Ville<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex : Lille" className="ao-input h-10 px-3 text-sm font-semibold" /></label>
        <label className="ao-label">Métier<input value={businessType} onChange={(event) => setBusinessType(event.target.value)} placeholder="Ex : Salon de beauté" className="ao-input h-10 px-3 text-sm font-semibold" /></label>
        <button onClick={() => void runSearch()} disabled={Boolean(busy)} className="ao-btn-primary h-10 px-5 text-sm font-black disabled:opacity-50">{busy === "search" ? "Recherche…" : "Rechercher"}</button>
      </div>
      {progress ? <div className="mt-3 flex items-center gap-2 text-xs font-black text-[#4C1D95]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#A855F7]" />{progress}</div> : null}
      {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div> : null}
      {notice ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{notice}</div> : null}
    </section>

    <section>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-black">Bibliothèque des recherches</h2><span className="text-xs font-semibold text-[#8B7AA8]">{searches.length} recherche{searches.length > 1 ? "s" : ""}</span></div>
      {searches.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{searches.map((search) => <article key={search.id} className="rounded-xl border border-[#E8E4DB] bg-white p-3">
        <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-black">{search.city}</div><div className="text-xs font-semibold text-[#6B617F]">{search.business_type}</div></div><time className="text-[10px] text-[#8B7AA8]">{new Date(search.created_at).toLocaleDateString("fr-FR")}</time></div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-[#6B617F]"><span>{search.result_count} uniques</span><span>{search.google_result_count ?? search.result_count} Google</span><span>{search.imported_count} reliés</span></div>
        <div className="mt-3 flex gap-1.5"><button onClick={() => openSearch(search)} className="rounded-md bg-[#F3E8FF] px-2.5 py-1.5 text-[11px] font-black text-[#4C1D95]">Ouvrir</button><button onClick={() => void runSearch(false, { city: search.city, businessType: search.business_type })} className="rounded-md border border-[#E8E4DB] px-2.5 py-1.5 text-[11px] font-bold">Relancer</button><button disabled={busy === "delete"} onClick={() => void deleteSearch(search.id)} className="ml-auto px-2 py-1 text-[11px] font-bold text-red-600">Supprimer</button></div>
      </article>)}</div> : <div className="rounded-xl border border-dashed border-[#D9D1C3] p-5 text-center text-xs font-semibold text-[#8B7AA8]">Vos recherches Google Places apparaîtront ici.</div>}
    </section>

    {results.length ? <section className="overflow-hidden rounded-xl border border-[#E8E4DB] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E4DB] px-4 py-3"><div><div className="text-base font-black text-emerald-700">{uniqueCount || results.length} commerces uniques trouvés</div><div className="mt-0.5 text-xs font-semibold text-[#8B7AA8]">{googleCount || results.length} résultats Google · {results.filter((item) => item.alreadyExists).length} déjà dans la base</div></div><button onClick={() => void importSelection()} disabled={!selected.size || Boolean(busy)} className="ao-btn-primary px-3.5 py-2 text-xs font-black disabled:opacity-40">{busy === "import" ? "Enrichissement et ajout…" : `Ajouter la sélection (${selected.size})`}</button></div>
      <div className="overflow-x-auto"><table className="min-w-[1120px] w-full border-collapse text-left text-xs"><thead className="bg-[#FAF9F7] text-[10px] uppercase tracking-wide text-[#8B7AA8]"><tr><th className="p-3"><input aria-label="Tout sélectionner" type="checkbox" checked={selectable.length > 0 && selected.size === selectable.length} onChange={() => setSelected(selected.size === selectable.length ? new Set() : new Set(selectable.map((item) => item.placeId)))} /></th>{["Nom", "Ville", "Métier", "Téléphone", "Email", "Note Google", "Nombre d’avis", "Site", "Statut", ""].map((item) => <th key={item} className="whitespace-nowrap p-3 font-black">{item}</th>)}</tr></thead>
        <tbody>{results.map((item) => <tr key={item.placeId} className="border-t border-[#EEEAE3] hover:bg-[#FCFBF9]"><td className="p-3"><input aria-label={`Sélectionner ${item.name}`} type="checkbox" disabled={item.alreadyExists} checked={selected.has(item.placeId)} onChange={() => toggle(item.placeId)} /></td><td className="max-w-[210px] p-3 font-black">{item.name}<div className="truncate text-[10px] font-medium text-[#8B7AA8]">{item.address}</div></td><td className="p-3 font-semibold">{item.city ?? "—"}</td><td className="p-3">{item.businessType ?? "—"}</td><td className="p-3">{item.phone ?? "—"}</td><td className="p-3">{item.email ?? "À enrichir à l’ajout"}</td><td className="p-3 font-black">{item.rating ? `${item.rating} ★` : "—"}</td><td className="p-3">{item.reviewsCount ?? "—"}</td><td className="p-3">{item.website ? <a href={item.website} target="_blank" rel="noreferrer" className="font-bold text-[#4C1D95]">Ouvrir</a> : "—"}</td><td className="p-3">{item.alreadyExists ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">Déjà dans la base</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">Nouveau</span>}</td><td className="p-3">{item.existingLeadId ? <Link href={`/crm/leads/${item.existingLeadId}`} className="font-black text-[#4C1D95]">Voir la fiche</Link> : <button onClick={() => void importSelection([item.placeId])} disabled={Boolean(busy)} className="font-black text-[#4C1D95]">Ajouter</button>}</td></tr>)}</tbody></table></div>
      {nextPageToken ? <div className="border-t border-[#E8E4DB] p-3 text-center"><button onClick={() => void runSearch(true)} disabled={Boolean(busy)} className="ao-btn-secondary px-4 py-2 text-xs font-black">{busy === "more" ? "Chargement…" : "Charger encore plus"}</button></div> : null}
    </section> : null}
  </div>;
}
