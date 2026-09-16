export type VisualSourceMode = "ai" | "merchant" | "mixed";

type CategoryCandidate = { id: string; name: string; description: string | null };
type AssetCandidate = { id: string; category_id: string | null; alt_text: string | null; use_count: number; last_used_at: string | null; created_at: string };

const CONCEPT_GROUPS = [
  ["equipe", "collaborateur", "collaboratrice", "expert", "portrait", "rencontr", "staff", "team"],
  ["prestation", "service", "soin", "massage", "rendez", "traitement", "experience"],
  ["produit", "article", "collection", "nouveau", "nouveaute", "plat", "creation"],
  ["commerce", "lieu", "boutique", "salon", "restaurant", "institut", "atelier", "interieur", "facade"],
  ["ambiance", "atmosphere", "moment", "coulisse", "detail", "deco", "univers"],
  ["avant", "apres", "transformation", "resultat", "evolution"],
  ["evenement", "atelier", "animation", "inauguration", "soiree", "portes", "ouvertes"]
] as const;

function normalizeToken(token: string) {
  const normalized = token.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length > 5 && normalized.endsWith("es")) return normalized.slice(0, -2);
  if (normalized.length > 4 && normalized.endsWith("s")) return normalized.slice(0, -1);
  return normalized;
}

function semanticTokens(value: string | null | undefined) {
  const direct = new Set(String(value ?? "").split(/[^\p{L}\p{N}]+/u).map(normalizeToken).filter((token) => token.length >= 2));
  for (const group of CONCEPT_GROUPS) if (group.some((token) => direct.has(normalizeToken(token)))) group.forEach((token) => direct.add(normalizeToken(token)));
  return direct;
}

export function rankMediaCategories({ subject, categories, preferredCategoryName }: { subject: string; categories: CategoryCandidate[]; preferredCategoryName?: string | null }) {
  const subjectTokens = semanticTokens(`${subject} ${preferredCategoryName ?? ""}`);
  const preferredTokens = semanticTokens(preferredCategoryName);
  return categories.map((category) => {
    const nameTokens = semanticTokens(category.name);
    const descriptionTokens = semanticTokens(category.description);
    let score = 0;
    for (const token of subjectTokens) { if (nameTokens.has(token)) score += 8; if (descriptionTokens.has(token)) score += 3; }
    for (const token of preferredTokens) { if (nameTokens.has(token)) score += 12; if (descriptionTokens.has(token)) score += 5; }
    if (/autre/i.test(category.name)) score -= 20;
    return { ...category, score };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fr"));
}

export function selectBestMerchantAsset<T extends AssetCandidate>({ subject, categories, assets, preferredCategoryName }: { subject: string; categories: CategoryCandidate[]; assets: T[]; preferredCategoryName?: string | null }) {
  if (!assets.length) return null;
  const ranked = rankMediaCategories({ subject, categories, preferredCategoryName });
  const populatedCategory = ranked.find((category) => assets.some((asset) => asset.category_id === category.id));
  const pool = populatedCategory ? assets.filter((asset) => asset.category_id === populatedCategory.id) : assets;
  const subjectTokens = semanticTokens(subject);
  return [...pool].sort((a, b) => {
    const score = (asset: T) => { const tokens = semanticTokens(asset.alt_text); let semantic = 0; for (const token of subjectTokens) if (tokens.has(token)) semantic += 2; return semantic * 100 - asset.use_count; };
    return score(b) - score(a) || (a.last_used_at ? Date.parse(a.last_used_at) : 0) - (b.last_used_at ? Date.parse(b.last_used_at) : 0) || Date.parse(b.created_at) - Date.parse(a.created_at);
  })[0] ?? null;
}

export function decideVisualSource(mode: VisualSourceMode, nextMixedSource: "ai" | "merchant", hasMerchantAssets: boolean) {
  if (mode === "ai") return { source: "ai" as const, advance: false };
  if (mode === "merchant") return { source: hasMerchantAssets ? "merchant" as const : "none" as const, advance: false };
  if (!hasMerchantAssets) return { source: "ai" as const, advance: false };
  return { source: nextMixedSource, advance: true };
}
