"use client";

import { useMemo, useRef, useState } from "react";
import type { MerchantMediaLibrary, VisualSourceMode } from "@/lib/merchant-media";

const sourceOptions: { value: VisualSourceMode; title: string; description: string }[] = [
  { value: "ai", title: "Photos générées par IA", description: "Hans crée une image adaptée à chaque contenu." },
  { value: "merchant", title: "Photos de mon commerce", description: "Hans utilise uniquement vos photos réelles." },
  { value: "mixed", title: "Les deux", description: "Hans alterne réellement : commerce, IA, commerce, IA…" }
];

export function MediaLibrarySettings({ initialLibrary }: { initialLibrary: MerchantMediaLibrary }) {
  const [library, setLibrary] = useState(initialLibrary);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(initialLibrary.categories[0]?.id ?? "all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleAssets = useMemo(
    () => activeCategoryId === "all" ? library.assets : library.assets.filter((asset) => asset.category_id === activeCategoryId),
    [activeCategoryId, library.assets]
  );
  const selectedCategory = library.categories.find((category) => category.id === activeCategoryId);

  async function refresh() {
    const response = await fetch("/api/settings/media", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Actualisation impossible.");
    setLibrary(body);
  }

  async function upload(files: FileList | File[]) {
    const usable = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!usable.length) return;
    if (activeCategoryId === "all") {
      setError("Choisissez d’abord une catégorie pour classer ces photos.");
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      const form = new FormData();
      form.set("category_id", activeCategoryId);
      usable.forEach((file) => form.append("images", file));
      const response = await fetch("/api/settings/media", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Import impossible.");
      await refresh();
      const failures = Array.isArray(body.failures) ? body.failures.length : 0;
      setNotice(`${body.assets.length} photo${body.assets.length > 1 ? "s" : ""} ajoutée${body.assets.length > 1 ? "s" : ""}.${failures ? ` ${failures} fichier${failures > 1 ? "s" : ""} refusé${failures > 1 ? "s" : ""}.` : ""}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Import impossible.");
    } finally { setBusy(false); }
  }

  async function createCategory() {
    const name = window.prompt("Nom de la nouvelle catégorie");
    if (!name?.trim()) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/settings/media/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Création impossible.");
      await refresh(); setActiveCategoryId(body.category.id);
    } catch (categoryError) { setError(categoryError instanceof Error ? categoryError.message : "Création impossible."); }
    finally { setBusy(false); }
  }

  async function renameCategory() {
    if (!selectedCategory) return;
    const name = window.prompt("Nouveau nom de la catégorie", selectedCategory.name);
    if (!name?.trim() || name.trim() === selectedCategory.name) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/settings/media/categories/${selectedCategory.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Modification impossible.");
      await refresh();
    } catch (categoryError) { setError(categoryError instanceof Error ? categoryError.message : "Modification impossible."); }
    finally { setBusy(false); }
  }

  async function deleteCategory() {
    if (!deleteCategoryId || !destinationId) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/settings/media/categories/${deleteCategoryId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ destinationCategoryId: destinationId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Suppression impossible.");
      setDeleteCategoryId(null); setDestinationId(""); setActiveCategoryId(destinationId); await refresh();
    } catch (categoryError) { setError(categoryError instanceof Error ? categoryError.message : "Suppression impossible."); }
    finally { setBusy(false); }
  }

  async function moveSelected(categoryId: string) {
    if (!categoryId || !selectedIds.length) return;
    setBusy(true); setError(null);
    try {
      await Promise.all(selectedIds.map(async (assetId) => {
        const response = await fetch(`/api/settings/media/assets/${assetId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId }) });
        if (!response.ok) throw new Error((await response.json()).error ?? "Déplacement impossible.");
      }));
      setSelectedIds([]); await refresh(); setNotice("Photos déplacées.");
    } catch (moveError) { setError(moveError instanceof Error ? moveError.message : "Déplacement impossible."); }
    finally { setBusy(false); }
  }

  async function removeAsset(assetId: string) {
    if (!window.confirm("Supprimer définitivement cette photo de la médiathèque ?")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/settings/media/assets/${assetId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Suppression impossible.");
      setSelectedIds((current) => current.filter((id) => id !== assetId)); await refresh();
    } catch (removeError) { setError(removeError instanceof Error ? removeError.message : "Suppression impossible."); }
    finally { setBusy(false); }
  }

  async function setMode(mode: VisualSourceMode) {
    setLibrary((current) => ({ ...current, preference: { ...current.preference, image_source_mode: mode } }));
    setError(null);
    try {
      const response = await fetch("/api/settings/media/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Préférence non enregistrée.");
      setLibrary((current) => ({ ...current, preference: body.preference }));
    } catch (preferenceError) {
      setError(preferenceError instanceof Error ? preferenceError.message : "Préférence non enregistrée.");
      await refresh().catch(() => undefined);
    }
  }

  return <div className="px-[30px] pb-[28px] pt-[20px]">
    <div className="grid gap-3 md:grid-cols-3">
      {sourceOptions.map((option) => {
        const selected = library.preference.image_source_mode === option.value;
        return <button key={option.value} type="button" onClick={() => setMode(option.value)} className={`rounded-[16px] border p-4 text-left transition ${selected ? "border-[#6E4DE0] bg-[#F5F0FF] shadow-[0_0_0_2px_rgba(110,77,224,.08)]" : "border-[#EBE6DF] bg-white hover:border-[#CDBDEB]"}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-[#6E4DE0]" : "border-[#C9C3CE]"}`}>{selected ? <span className="h-2.5 w-2.5 rounded-full bg-[#6E4DE0]" /> : null}</span>
          <strong className="mt-3 block text-[13.5px] text-[#17131F]">{option.title}</strong>
          <span className="mt-1 block text-xs leading-5 text-[#6E6A76]">{option.description}</span>
        </button>;
      })}
    </div>

    <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-[#F0ECE7] pt-6">
      <button type="button" onClick={() => setActiveCategoryId("all")} className={`rounded-full px-3.5 py-2 text-xs font-bold ${activeCategoryId === "all" ? "bg-[#2B1A4A] text-white" : "bg-[#F6F3EF] text-[#6E6A76]"}`}>Toutes · {library.assets.length}</button>
      {library.categories.map((category) => <button key={category.id} type="button" onClick={() => setActiveCategoryId(category.id)} className={`rounded-full px-3.5 py-2 text-xs font-bold ${activeCategoryId === category.id ? "bg-[#2B1A4A] text-white" : "bg-[#F6F3EF] text-[#6E6A76]"}`}>{category.name} · {library.assets.filter((asset) => asset.category_id === category.id).length}</button>)}
      <button type="button" onClick={createCategory} disabled={busy} className="rounded-full border border-[#D8CAEE] px-3.5 py-2 text-xs font-bold text-[#6E4DE0]">+ Catégorie</button>
    </div>

    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-extrabold text-[#17131F]">{selectedCategory?.name ?? "Toutes les photos"}</h3>
        <p className="mt-0.5 text-xs text-[#8A858F]">Hans choisit automatiquement la photo la plus pertinente selon le sujet.</p>
      </div>
      {selectedCategory ? <div className="flex gap-2">
        <button type="button" onClick={renameCategory} disabled={busy} className="rounded-full border border-[#EBE6DF] px-3 py-1.5 text-xs font-semibold text-[#6E6A76]">Renommer</button>
        {selectedCategory.name !== "Autres" ? <button type="button" onClick={() => { setDeleteCategoryId(selectedCategory.id); setDestinationId(library.categories.find((category) => category.name === "Autres")?.id ?? ""); }} disabled={busy} className="rounded-full border border-[#F0D7DD] px-3 py-1.5 text-xs font-semibold text-[#9A4057]">Supprimer</button> : null}
      </div> : null}
    </div>

    {deleteCategoryId ? <div className="mt-4 rounded-[14px] border border-[#F0D7DD] bg-[#FFF8FA] p-4">
      <strong className="text-sm text-[#66283A]">Où déplacer les photos de cette catégorie ?</strong>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="rounded-full border border-[#E4DBF6] bg-white px-4 py-2 text-xs font-semibold">
          {library.categories.filter((category) => category.id !== deleteCategoryId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button type="button" onClick={deleteCategory} disabled={busy || !destinationId} className="rounded-full bg-[#8C354D] px-4 py-2 text-xs font-bold text-white">Déplacer puis supprimer</button>
        <button type="button" onClick={() => setDeleteCategoryId(null)} className="rounded-full px-3 py-2 text-xs font-semibold text-[#6E6A76]">Annuler</button>
      </div>
    </div> : null}

    <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files); }} className={`mt-4 rounded-[16px] border-2 border-dashed p-6 text-center transition ${dragging ? "border-[#6E4DE0] bg-[#F5F0FF]" : "border-[#DCCFED] bg-[#FBFAFF]"}`}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => event.currentTarget.files && void upload(event.currentTarget.files)} />
      <p className="text-sm font-bold text-[#2B1A4A]">Glissez vos photos ici</p>
      <p className="mt-1 text-xs text-[#8A858F]">JPG, PNG ou WebP · 12 Mo maximum · 20 fichiers par import</p>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy || activeCategoryId === "all"} className="mt-3 rounded-full bg-[#6E4DE0] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Traitement…" : activeCategoryId === "all" ? "Choisissez une catégorie" : "Ajouter des photos"}</button>
    </div>

    {error ? <p className="mt-3 rounded-xl bg-[#FEF2F2] px-4 py-3 text-xs font-semibold text-[#B4233C]">{error}</p> : null}
    {notice ? <p className="mt-3 rounded-xl bg-[#F0FDF4] px-4 py-3 text-xs font-semibold text-[#247A45]">{notice}</p> : null}

    {selectedIds.length ? <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[14px] bg-[#F5F0FF] p-3">
      <span className="mr-auto text-xs font-bold text-[#4C1D95]">{selectedIds.length} photo{selectedIds.length > 1 ? "s" : ""} sélectionnée{selectedIds.length > 1 ? "s" : ""}</span>
      <select defaultValue="" onChange={(event) => { void moveSelected(event.target.value); event.currentTarget.value = ""; }} className="rounded-full border border-[#D8CAEE] bg-white px-3 py-2 text-xs font-semibold"><option value="" disabled>Déplacer vers…</option>{library.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <button type="button" onClick={() => setSelectedIds([])} className="px-2 text-xs font-semibold text-[#6E6A76]">Désélectionner</button>
    </div> : null}

    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {visibleAssets.map((asset) => {
        const selected = selectedIds.includes(asset.id);
        return <article key={asset.id} className={`group relative overflow-hidden rounded-[14px] border bg-white ${selected ? "border-[#6E4DE0] ring-2 ring-[#D8CAEE]" : "border-[#EBE6DF]"}`}>
          <button type="button" onClick={() => setSelectedIds((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id])} className="block aspect-square w-full overflow-hidden bg-[#F6F3EF] text-left">
            <img src={asset.signed_url} alt={asset.alt_text ?? "Photo du commerce"} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
            <span className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border text-xs ${selected ? "border-[#6E4DE0] bg-[#6E4DE0] text-white" : "border-white/80 bg-white/80 text-transparent"}`}>✓</span>
          </button>
          <div className="flex items-center gap-2 p-2.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#6E6A76]">{asset.original_filename ?? asset.category_name ?? "Photo"}</span>
            <button type="button" onClick={() => void removeAsset(asset.id)} aria-label="Supprimer la photo" className="rounded-full px-2 py-1 text-xs font-bold text-[#A14C61] hover:bg-[#FFF1F4]">×</button>
          </div>
        </article>;
      })}
      {!visibleAssets.length ? <div className="col-span-full rounded-[14px] border border-dashed border-[#DED7E5] py-10 text-center text-sm text-[#8A858F]">Aucune photo dans cette catégorie.</div> : null}
    </div>
  </div>;
}
