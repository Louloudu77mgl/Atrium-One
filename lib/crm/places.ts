export type GooglePlacesPage<T> = { places: T[]; nextPageToken: string | null };
export const GOOGLE_PLACES_PAGE_SIZE = 20;
export const GOOGLE_PLACES_MAX_PAGES = 5;
export const GOOGLE_PLACES_MAX_RESULTS = 100;

export async function collectGooglePlacesPages<T>(fetchPage: (pageToken?: string) => Promise<GooglePlacesPage<T>>, options: { initialPageToken?: string; maxPages?: number; maxResults?: number } = {}) {
  const maxPages = Math.max(1, options.maxPages ?? 5);
  const maxResults = Math.max(20, options.maxResults ?? 100);
  const places: T[] = [];
  const seenTokens = new Set<string>();
  let pageToken = options.initialPageToken;
  let nextPageToken: string | null = null;
  let pagesFetched = 0;

  while (pagesFetched < maxPages && places.length < maxResults) {
    const page = await fetchPage(pageToken);
    pagesFetched += 1;
    places.push(...page.places.slice(0, maxResults - places.length));
    nextPageToken = page.nextPageToken;
    if (!nextPageToken || seenTokens.has(nextPageToken) || places.length >= maxResults) break;
    seenTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }

  return { places, nextPageToken, pagesFetched };
}
