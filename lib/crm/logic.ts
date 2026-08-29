export type DedupeLead = { id: string; google_place_id?: string | null; website?: string | null; phone?: string | null; name?: string | null; address?: string | null };
export type DedupeProspect = { placeId?: string | null; website?: string | null; phone?: string | null; name?: string | null; address?: string | null };

export function normalizePhone(value?: string | null) {
  let normalized = value?.replace(/[^\d+]/g, "") || "";
  if (normalized.startsWith("0033")) normalized = `0${normalized.slice(4)}`;
  if (normalized.startsWith("+33")) normalized = `0${normalized.slice(3)}`;
  return normalized || null;
}

export function normalizeDomain(value?: string | null) {
  if (!value) return null;
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return null; }
}

export function normalizeNameAddress(name?: string | null, address?: string | null) {
  return `${name ?? ""}|${address ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9|]/g, "");
}

export function findDuplicate(leads: DedupeLead[], prospect: DedupeProspect) {
  const place = prospect.placeId && leads.find((lead) => lead.google_place_id === prospect.placeId);
  if (place) return place;
  const domain = normalizeDomain(prospect.website);
  if (domain) { const match = leads.find((lead) => normalizeDomain(lead.website) === domain); if (match) return match; }
  const phone = normalizePhone(prospect.phone);
  if (phone) { const match = leads.find((lead) => normalizePhone(lead.phone) === phone); if (match) return match; }
  const fingerprint = normalizeNameAddress(prospect.name, prospect.address);
  return leads.find((lead) => normalizeNameAddress(lead.name, lead.address) === fingerprint) ?? null;
}

export function hasEffectiveModuleAccess(accountEnabled: boolean, moduleEnabled: boolean) {
  return accountEnabled && moduleEnabled;
}

export function associationStrength(input: { leadEmail?: string | null; accountEmail?: string | null; leadPhone?: string | null; accountPhone?: string | null; leadWebsite?: string | null; accountWebsite?: string | null }) {
  if (input.leadEmail && input.accountEmail && input.leadEmail.trim().toLowerCase() === input.accountEmail.trim().toLowerCase()) return "exact_email" as const;
  if (normalizePhone(input.leadPhone) && normalizePhone(input.leadPhone) === normalizePhone(input.accountPhone)) return "phone" as const;
  if (normalizeDomain(input.leadWebsite) && normalizeDomain(input.leadWebsite) === normalizeDomain(input.accountWebsite)) return "domain" as const;
  return "none" as const;
}
