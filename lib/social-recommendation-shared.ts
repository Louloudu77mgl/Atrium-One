import type { ReviewSocialPostIdea } from "@/lib/review-insights";
import type { Json, SocialPostRow } from "@/lib/supabase/types";

export type RecommendationOrigin = {
  version: 1;
  themeKey: string;
  sourceType: "positive_review" | "negative_review" | "local_event" | "calendar" | "editorial";
  sourceLabel: string;
  title: string;
  eventDate: string | null;
};

const stopWords = new Set(["avec", "dans", "pour", "vous", "votre", "notre", "chez", "plus", "post", "instagram", "client", "clients", "faire", "cette", "comme", "tout", "sans", "une", "des", "les", "sur"]);

export function normalizeTheme(value: string) {
  return value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function getRecommendationOrigin(idea: Partial<ReviewSocialPostIdea>): RecommendationOrigin {
  const sourceType = idea.localEvent ? "local_event" : idea.seasonalMoment ? "calendar" : idea.sourcePainPoint ? "negative_review" : idea.sourceStrength ? "positive_review" : "editorial";
  const sourceLabel = idea.localEvent || idea.seasonalMoment || idea.sourcePainPoint || idea.sourceStrength || idea.title || "";
  const kind = sourceType.endsWith("_review") ? "insight" : sourceType;
  const eventDate = idea.localEvent || idea.seasonalMoment ? idea.eventDate || null : null;
  return { version: 1, themeKey: `${kind}:${normalizeTheme(sourceLabel)}${eventDate ? `:${eventDate}` : ""}`, sourceType, sourceLabel, title: idea.title || "", eventDate };
}

export function readRecommendationOrigin(state: Json | null | undefined): RecommendationOrigin | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const origin = state._recommendation;
  if (!origin || typeof origin !== "object" || Array.isArray(origin)) return null;
  if (origin.version !== 1 || typeof origin.themeKey !== "string" || typeof origin.sourceLabel !== "string") return null;
  if (!["positive_review", "negative_review", "local_event", "calendar", "editorial"].includes(String(origin.sourceType))) return null;
  return origin as RecommendationOrigin;
}

export function withRecommendationOrigin(state: Json, idea: Partial<ReviewSocialPostIdea>): Json {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;
  return { ...state, _recommendation: getRecommendationOrigin(idea) };
}

export function preserveRecommendationOrigin(next: Json, previous: Json | null): Json {
  const origin = readRecommendationOrigin(previous);
  if (!next || typeof next !== "object" || Array.isArray(next)) return origin ? previous : next;
  const { _recommendation: ignored, ...document } = next;
  return origin ? { ...document, _recommendation: origin } : document;
}

export function similarityScore(left: string, right: string) {
  const tokenize = (value: string) => new Set(normalizeTheme(value).split(" ").filter((token) => token.length >= 4 && !stopWords.has(token)));
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => { if (rightTokens.has(token)) overlap += 1; });
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

export function isRecommendationPublished(idea: ReviewSocialPostIdea, posts: Pick<SocialPostRow, "platform" | "status" | "builder_state" | "title" | "caption">[]) {
  const origin = getRecommendationOrigin(idea);
  return posts.some((post) => {
    if (post.platform !== "instagram" || post.status !== "published") return false;
    const saved = readRecommendationOrigin(post.builder_state);
    if (saved) return saved.themeKey === origin.themeKey;
    const text = `${post.title} ${post.caption}`;
    const source = normalizeTheme(origin.sourceLabel);
    return (source.length >= 8 && normalizeTheme(text).includes(source))
      || similarityScore(`${idea.title} ${idea.angle}`, text) >= 0.55;
  });
}

export function buildCreatePostHref(idea: ReviewSocialPostIdea) {
  const params = new URLSearchParams({ platform: "instagram", title: idea.title, angle: idea.angle, source: getRecommendationOrigin(idea).sourceLabel });
  for (const field of ["sourcePainPoint", "sourceStrength", "category", "seasonalMoment", "localEvent", "eventDate", "sourceUrl", "visualDirection"] as const) {
    if (idea[field]) params.set(field, idea[field]);
  }
  return `/social/create?${params.toString()}`;
}

export function parisDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function recommendationWeek(date = new Date()) {
  const monday = new Date(`${parisDateKey(date)}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return monday.toISOString().slice(0, 10);
}

export function isUpcomingRecommendation(idea: ReviewSocialPostIdea, today = parisDateKey()) {
  if (!idea.localEvent && !idea.seasonalMoment) return true;
  return Boolean(idea.eventDate && idea.eventDate >= today && (!idea.localEvent || idea.sourceUrl));
}

export function selectRecommendationMix(groups: ReviewSocialPostIdea[][], posts: SocialPostRow[], target = 10, today = parisDateKey()) {
  const selected: ReviewSocialPostIdea[] = [];
  const quotas = [Math.max(1, target - 4), 2, 2];
  const add = (idea: ReviewSocialPostIdea) => {
    if (selected.length >= target || !isUpcomingRecommendation(idea, today) || isRecommendationPublished(idea, posts)) return;
    if (selected.some((other) => getRecommendationOrigin(other).themeKey === getRecommendationOrigin(idea).themeKey)) return;
    selected.push(idea);
  };
  groups.forEach((group, index) => {
    const start = selected.length;
    for (const idea of group) {
      if (selected.length - start >= quotas[index]) break;
      add(idea);
    }
  });
  groups.flat().forEach(add);
  return selected;
}
