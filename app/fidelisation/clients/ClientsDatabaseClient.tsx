"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { buttonStyles } from "@/lib/design-system";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { RcuCustomerRow } from "@/lib/rcu-store";
import { getUserErrorMessage } from "@/lib/user-feedback";

type SourceFilter = "all" | "rcu" | "import";
type StatusFilter = "all" | "ready" | "no-consent" | "unsubscribed" | "incomplete";
type SortKey = "recent" | "name" | "source" | "status";

export function ClientsDatabaseClient({ customers }: { customers: RcuCustomerRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const { toast, showToast } = useToast();
  const hasActiveFilters = query.trim() !== "" || sourceFilter !== "all" || statusFilter !== "all" || sortKey !== "recent";

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return customers
      .filter((customer) => {
        const source = getCustomerSource(customer);
        const status = getCustomerStatus(customer);

        if (sourceFilter !== "all" && source !== sourceFilter) return false;
        if (statusFilter !== "all" && status.key !== statusFilter) return false;
        if (!normalizedQuery) return true;

        return [
          customer.first_name,
          customer.last_name,
          customer.phone,
          customer.email,
          customer.favorite_products.join(" "),
          customer.notes,
          source,
          status.label
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => sortCustomers(left, right, sortKey));
  }, [customers, query, sourceFilter, statusFilter, sortKey]);

  async function onCsvFileChange(file: File | null) {
    if (!file) return;
    setCsvText(await file.text());
  }

  async function importCsv() {
    if (!csvText.trim()) {
      showToast("Ajoutez un fichier CSV ou collez son contenu.", "error");
      return;
    }

    setImporting(true);
    showToast("Import des contacts en cours...", "saving");
    try {
      const response = await fetchWithTimeout("/api/rcu/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText })
      }, 30000);
      const data = (await response.json()) as { imported?: number; error?: string };

      if (!response.ok) throw new Error(data.error ?? "Import impossible.");

      setCsvText("");
      setImportModalOpen(false);
      router.refresh();
      showToast(`${data.imported ?? 0} contact(s) importé(s)`, "success");
    } catch (error) {
      showToast(getUserErrorMessage(error, "Import impossible."), "error");
    } finally {
      setImporting(false);
    }
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      showToast("Téléphone copié", "success");
    } catch {
      showToast("Impossible de copier le téléphone.", "error");
    }
  }

  function resetFilters() {
    setQuery("");
    setSourceFilter("all");
    setStatusFilter("all");
    setSortKey("recent");
  }

  return (
    <div className="mx-auto max-w-[1380px]">
      <section className="mb-4 rounded-[22px] border border-[#E8E0F5] bg-white px-4 py-3 shadow-[0_10px_32px_rgba(76,29,149,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3E8FF] text-[#6D28D9]">
              <Icon name="inbox" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-[#211432]">Base de données clients</h1>
              <p className="text-xs font-bold text-[#8B7AA8]">
                {filteredCustomers.length}/{customers.length} contacts
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative sm:w-[360px]">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B7AA8]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un contact..." className="h-10 w-full rounded-full border border-[#E5DAF5] bg-[#FBFAFF] pl-9 pr-3 text-sm font-semibold text-[#211432] outline-none transition focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-[#F3E8FF]" />
            </label>
            <button type="button" onClick={() => setImportModalOpen(true)} className={`${buttonStyles.primary} h-10 whitespace-nowrap rounded-full px-4`}>
              Importer
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
        <section className="overflow-hidden rounded-[26px] border border-[#E8E0F5] bg-white shadow-[0_18px_60px_rgba(76,29,149,0.08)]">
          {filteredCustomers.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3E8FF] text-[#6D28D9]">
                <Icon name="inbox" className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-black text-[#211432]">Aucun contact trouvé</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B617F]">Modifiez votre recherche ou importez un fichier CSV pour enrichir la base.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0EAF8]">
              {filteredCustomers.map((customer) => (
                <CustomerTableRow key={customer.id} customer={customer} onCopyPhone={copyPhone} />
              ))}
            </div>
          )}
        </section>

        <aside className="xl:sticky xl:top-24">
          <div className="rounded-[24px] border border-[#E8E0F5] bg-white p-4 shadow-[0_14px_42px_rgba(76,29,149,0.08)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[#211432]">Filtres</h2>
                <p className="mt-0.5 text-xs font-semibold text-[#8B7AA8]">Affinez la table</p>
              </div>
              {hasActiveFilters ? (
                <button type="button" onClick={resetFilters} className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-black text-[#6D28D9] transition hover:bg-[#E9D5FF]">
                  Reset
                </button>
              ) : null}
            </div>

            <div className="grid gap-3">
              <FilterField label="Source">
                <Select value={sourceFilter} onChange={(value) => setSourceFilter(value as SourceFilter)} options={[
                  ["all", "Toutes"],
                  ["rcu", "RCU"],
                  ["import", "Import"]
                ]} />
              </FilterField>
              <FilterField label="Statut">
                <Select value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[
                  ["all", "Tous"],
                  ["ready", "Activable"],
                  ["no-consent", "Sans consentement"],
                  ["unsubscribed", "Désinscrit"],
                  ["incomplete", "Incomplet"]
                ]} />
              </FilterField>
              <FilterField label="Trier par">
                <Select value={sortKey} onChange={(value) => setSortKey(value as SortKey)} options={[
                  ["recent", "Plus récents"],
                  ["name", "Nom A-Z"],
                  ["source", "Source"],
                  ["status", "Statut"]
                ]} />
              </FilterField>
            </div>

            <div className="mt-4 rounded-2xl bg-[#FBFAFF] p-3 text-xs font-bold leading-5 text-[#6B617F]">
              <span className="text-[#4C1D95]">{filteredCustomers.length}</span> résultat{filteredCustomers.length > 1 ? "s" : ""} dans la vue actuelle.
            </div>
          </div>
        </aside>
      </div>

      {importModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211432]/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-5 shadow-[0_24px_80px_rgba(33,20,50,0.34)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#211432]">Importer des clients</h2>
                <p className="mt-1 text-sm leading-6 text-[#6B617F]">CSV avec contact, anniversaire et consentements SMS/e-mail séparés.</p>
              </div>
              <button type="button" onClick={() => setImportModalOpen(false)} className="rounded-full border border-[#E9D5FF] px-3 py-1.5 text-sm font-black text-[#6D28D9] transition hover:bg-[#F3E8FF]">Fermer</button>
            </div>
            <label className="inline-flex cursor-pointer rounded-2xl bg-[#F3E8FF] px-4 py-2.5 text-sm font-black text-[#4C1D95] transition hover:-translate-y-0.5">
              Ajouter un CSV
              <input type="file" accept=".csv,text/csv" onChange={(event) => void onCsvFileChange(event.target.files?.[0] ?? null)} className="hidden" />
            </label>
            <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={8} className="mt-4 w-full resize-y rounded-2xl border border-[#E5DAF5] bg-[#FBFAFF] px-4 py-3 text-sm font-medium leading-6 text-[#211432] outline-none transition focus:border-[#7C3AED] focus:ring-4 focus:ring-[#F3E8FF]" placeholder={"prenom;nom;telephone;email;date_naissance;produit acheté;notes;consentement_sms;consentement_email\nCamille;Martin;06 12 34 56 78;camille@exemple.fr;12/05/1992;Produit préféré;Cliente fidèle;oui;oui"} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setImportModalOpen(false)} className={`${buttonStyles.secondary} rounded-2xl`}>Annuler</button>
              <button type="button" onClick={() => void importCsv()} disabled={importing} className={`${buttonStyles.primary} rounded-2xl disabled:opacity-60`}>{importing ? "Import..." : "Importer les clients"}</button>
            </div>
          </div>
        </div>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}

function CustomerTableRow({ customer, onCopyPhone }: { customer: RcuCustomerRow; onCopyPhone: (phone: string) => Promise<void> }) {
  const source = getCustomerSource(customer);
  const status = getCustomerStatus(customer);
  const displayName = `${customer.first_name} ${customer.last_name}`.trim() || "Client sans nom";
  const description = getCustomerDescription(customer);

  return (
    <article className="grid gap-4 px-5 py-6 transition hover:bg-[#FCFAFF] md:grid-cols-[180px_minmax(0,1fr)_150px_176px] md:items-center md:px-7">
      <div className="text-sm font-black text-[#9A8CAD]">
        <div>{formatDate(customer.created_at)}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.08em]">{source === "import" ? "Import CSV" : "Collecte RCU"}</div>
      </div>

      <Link href={`/fidelisation/clients/${customer.id}`} className="min-w-0">
        <h2 className="truncate text-lg font-black text-[#211432] transition hover:text-[#6D28D9]">{displayName}</h2>
        <p className="mt-1 line-clamp-2 text-base leading-6 text-[#6B617F]">{description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {customer.phone ? <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-black text-[#6D28D9]">{customer.phone}</span> : null}
          {customer.email ? <span className="rounded-full bg-[#F8F5FF] px-3 py-1 text-xs font-bold text-[#7B6A92]">{customer.email}</span> : null}
          {customer.opt_in_email ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">E-mail accepté</span> : null}
          {customer.opt_in_sms ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">SMS accepté</span> : null}
        </div>
      </Link>

      <div>
        <span className={status.className}>{status.label}</span>
      </div>

      <div className="flex items-center gap-3 md:justify-end">
        <RoundAction label="Copier téléphone" icon="phone" onClick={() => void onCopyPhone(customer.phone)} disabled={!customer.phone} />
        <RoundLink label="Voir la fiche" icon="document" href={`/fidelisation/clients/${customer.id}`} />
        <RoundAction label="SMS bientôt disponible" icon="message" onClick={() => undefined} disabled={!customer.opt_in_sms || customer.sms_unsubscribed} />
      </div>
    </article>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-xl border border-[#E5DAF5] bg-[#FBFAFF] px-3 text-xs font-black text-[#4C1D95] outline-none transition focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-[#F3E8FF]">
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>{label}</option>
      ))}
    </select>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#9A8CAD]">
      {label}
      {children}
    </label>
  );
}

function RoundAction({ label, icon, onClick, disabled = false }: { label: string; icon: "phone" | "message"; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E9D5FF] bg-white text-[#5B21B6] shadow-[0_8px_22px_rgba(76,29,149,0.12)] transition hover:-translate-y-0.5 hover:bg-[#F3E8FF] disabled:cursor-not-allowed disabled:opacity-35">
      <Icon name={icon} className="h-5 w-5" />
    </button>
  );
}

function RoundLink({ label, icon, href }: { label: string; icon: "document"; href: string }) {
  return (
    <Link aria-label={label} title={label} href={href} className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E9D5FF] bg-white text-[#5B21B6] shadow-[0_8px_22px_rgba(76,29,149,0.12)] transition hover:-translate-y-0.5 hover:bg-[#F3E8FF]">
      <Icon name={icon} className="h-5 w-5" />
    </Link>
  );
}

function getCustomerSource(customer: RcuCustomerRow): "rcu" | "import" {
  return customer.notes?.startsWith("Import clients") ? "import" : "rcu";
}

function getCustomerStatus(customer: RcuCustomerRow): { key: StatusFilter; label: string; className: string } {
  if (!customer.phone) {
    return { key: "incomplete", label: "Incomplet", className: "rounded-full bg-[#F6F1FF] px-4 py-2 text-sm font-black text-[#7B6A92]" };
  }

  if (customer.sms_unsubscribed) {
    return { key: "unsubscribed", label: "Désinscrit", className: "rounded-full bg-[#FFF1F2] px-4 py-2 text-sm font-black text-[#E11D48]" };
  }

  if (!customer.opt_in_sms && !customer.opt_in_email) {
    return { key: "no-consent", label: "Sans consentement", className: "rounded-full bg-[#FFF7ED] px-4 py-2 text-sm font-black text-[#C2410C]" };
  }

  return { key: "ready", label: "Activable", className: "rounded-full bg-[#EFE7FF] px-4 py-2 text-sm font-black text-[#5B21B6]" };
}

function getCustomerDescription(customer: RcuCustomerRow) {
  const products = customer.favorite_products.length > 0 ? customer.favorite_products.join(", ") : null;
  const note = customer.notes?.replace(/^Import clients\s*[-–—:]?\s*/i, "").trim();

  if (products && note) return `${products} · ${note}`;
  if (products) return products;
  if (note) return note;
  return customer.email ? "Contact client enregistré." : "Client sans information complémentaire.";
}

function sortCustomers(left: RcuCustomerRow, right: RcuCustomerRow, sortKey: SortKey) {
  if (sortKey === "name") {
    return `${left.first_name} ${left.last_name}`.localeCompare(`${right.first_name} ${right.last_name}`, "fr");
  }

  if (sortKey === "source") {
    return getCustomerSource(left).localeCompare(getCustomerSource(right), "fr");
  }

  if (sortKey === "status") {
    return getCustomerStatus(left).label.localeCompare(getCustomerStatus(right).label, "fr");
  }

  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
