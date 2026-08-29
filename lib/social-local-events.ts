import type { ReviewSocialPostIdea } from "@/lib/review-insights";
import type { MerchantRow } from "@/lib/supabase/types";

type OpenAIResponseBody = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

type LocalEventCandidate = {
  name?: unknown;
  date?: unknown;
  title?: unknown;
  angle?: unknown;
  sourceUrl?: unknown;
};

type CacheEntry = { expiresAt: number; ideas: ReviewSocialPostIdea[] };

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const globalCache = globalThis as typeof globalThis & { __atriumLocalEventCache?: Map<string, CacheEntry> };
const cache = globalCache.__atriumLocalEventCache ??= new Map<string, CacheEntry>();

export async function getUpcomingLocalSocialIdeas(merchant: MerchantRow, referenceDate = new Date()) {
  const city = merchant.city?.trim();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!city || !apiKey) return [];

  const dayKey = referenceDate.toISOString().slice(0, 10);
  const cacheKey = `${city.toLocaleLowerCase("fr-FR")}|${merchant.business_type.toLocaleLowerCase("fr-FR")}|${dayKey}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.ideas;

  const endDate = new Date(referenceDate);
  endDate.setUTCDate(endDate.getUTCDate() + 90);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        tools: [{
          type: "web_search",
          search_context_size: "low",
          user_location: { type: "approximate", city, country: "FR", timezone: "Europe/Paris" }
        }],
        instructions: [
          "Tu effectues une veille locale factuelle pour un commerce français.",
          "Retourne uniquement un JSON valide sous la forme {\"events\":[{\"name\":\"...\",\"date\":\"YYYY-MM-DD\",\"title\":\"...\",\"angle\":\"...\",\"sourceUrl\":\"https://...\"}] }.",
          "Ne conserve que des événements à venir dont la date et la ville sont confirmées par une source web identifiable.",
          "Écarte les événements passés, incertains, sans date ou sans URL source.",
          "Propose entre 2 et 5 idées Instagram naturelles pour le secteur du commerce, sans prétendre que le commerce participe officiellement à l'événement.",
          "Chaque titre et chaque angle doivent être distincts. Aucun texte générique de type post à préparer."
        ].join(" "),
        input: JSON.stringify({
          city,
          businessType: merchant.business_type,
          businessName: merchant.business_name,
          from: dayKey,
          to: endDate.toISOString().slice(0, 10)
        }),
        max_output_tokens: 1_200
      }),
      cache: "no-store"
    });
    if (!response.ok) return [];
    const body = await response.json() as OpenAIResponseBody;
    const text = body.output_text?.trim()
      || body.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("").trim()
      || "";
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as { events?: LocalEventCandidate[] };
    const startTime = new Date(`${dayKey}T00:00:00Z`).getTime();
    const endTime = endDate.getTime();
    const ideas = (parsed.events ?? []).flatMap((event): ReviewSocialPostIdea[] => {
      const name = cleanString(event.name, 90);
      const title = cleanString(event.title, 90);
      const angle = cleanString(event.angle, 240);
      const sourceUrl = cleanUrl(event.sourceUrl);
      const date = typeof event.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date : "";
      const eventTime = date ? new Date(`${date}T12:00:00Z`).getTime() : Number.NaN;
      if (!name || !title || !angle || !sourceUrl || !Number.isFinite(eventTime) || eventTime < startTime || eventTime > endTime) return [];
      return [{
        platform: "instagram",
        title,
        angle,
        localEvent: name,
        eventDate: date,
        sourceUrl,
        category: merchant.business_type
      }];
    }).slice(0, 5);
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, ideas });
    return ideas;
  } catch {
    return [];
  }
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function cleanUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}
