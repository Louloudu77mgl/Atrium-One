import { NextResponse, type NextRequest } from "next/server";
import { collectGooglePlacesPages, GOOGLE_PLACES_MAX_PAGES, GOOGLE_PLACES_MAX_RESULTS, GOOGLE_PLACES_PAGE_SIZE } from "@/lib/crm/places";
import { dedupeProspects } from "@/lib/crm/logic";
import { CrmApiError, crmErrorResponse, findDuplicate, getCrmContext } from "@/lib/crm/server";
import type { CrmLead, GoogleOpeningHours, PlacesProspect } from "@/lib/crm/types";

export const maxDuration = 60;

type GooglePlace = {
  id?: string; displayName?: { text?: string }; primaryTypeDisplayName?: { text?: string }; formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
  nationalPhoneNumber?: string; internationalPhoneNumber?: string; websiteUri?: string; rating?: number; userRatingCount?: number;
  googleMapsUri?: string; location?: { latitude?: number; longitude?: number }; businessStatus?: string;
  regularOpeningHours?: GoogleOpeningHours;
};

type GoogleResponse = { places?: GooglePlace[]; nextPageToken?: string; error?: { message?: string; status?: string } };

function addressPart(place: GooglePlace, type: string) {
  return place.addressComponents?.find((part) => part.types?.includes(type))?.longText ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getCrmContext();
    const body = await request.json() as { city?: string; businessType?: string; pageToken?: string; searchId?: string };
    const city = body.city?.trim().slice(0, 100);
    const businessType = body.businessType?.trim().slice(0, 120);
    if (!city || !businessType) return NextResponse.json({ error: { code: "INVALID_QUERY", message: "La ville et le métier sont requis." } }, { status: 400 });
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return NextResponse.json({ error: { code: "PLACES_NOT_CONFIGURED", message: "Google Places n’est pas encore configuré." } }, { status: 503 });

    const query = `${businessType} ${city}`;
    const collected = await collectGooglePlacesPages<GooglePlace>(async (pageToken) => {
      const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.primaryTypeDisplayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.location,places.businessStatus,places.regularOpeningHours,nextPageToken"
        },
        body: JSON.stringify({ textQuery: query, languageCode: "fr", regionCode: "FR", pageSize: GOOGLE_PLACES_PAGE_SIZE, ...(pageToken ? { pageToken } : {}) }),
        signal: AbortSignal.timeout(12000)
      });
      const googleData = await googleResponse.json() as GoogleResponse;
      if (!googleResponse.ok) {
        const quota = googleResponse.status === 429 || googleData.error?.status === "RESOURCE_EXHAUSTED";
        throw new CrmApiError(quota ? 429 : 502, quota ? "PLACES_QUOTA" : "PLACES_ERROR", quota ? "Quota Google Places atteint. Réessayez plus tard." : "Google Places n’a pas pu terminer la recherche.");
      }
      return { places: googleData.places ?? [], nextPageToken: googleData.nextPageToken ?? null };
    }, { initialPageToken: body.pageToken, maxPages: GOOGLE_PLACES_MAX_PAGES, maxResults: GOOGLE_PLACES_MAX_RESULTS });

    const rawProspects: PlacesProspect[] = collected.places.map((place) => ({
      placeId: place.id ?? "", name: place.displayName?.text ?? "Établissement", businessType: place.primaryTypeDisplayName?.text ?? businessType,
      address: place.formattedAddress ?? null, city: addressPart(place, "locality") ?? addressPart(place, "postal_town") ?? city,
      postalCode: addressPart(place, "postal_code"), phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
      email: null, emailSource: "unavailable", website: place.websiteUri ?? null, rating: place.rating ?? null,
      reviewsCount: place.userRatingCount ?? null, googleMapsUrl: place.googleMapsUri ?? null,
      latitude: place.location?.latitude ?? null, longitude: place.location?.longitude ?? null,
      businessStatus: place.businessStatus ?? null, openingHours: place.regularOpeningHours ?? {}, alreadyExists: false, existingLeadId: null
    }));
    const uniqueGoogleProspects = dedupeProspects(rawProspects);

    const { data: leadRows } = await supabase.from("crm_leads").select("id,google_place_id,website,phone,name,address").is("deleted_at", null);
    const leads = (leadRows ?? []) as Array<Pick<CrmLead, "id" | "google_place_id" | "website" | "phone" | "name" | "address">>;
    const prospects = uniqueGoogleProspects.map((prospect) => {
      const duplicate = findDuplicate(leads, prospect);
      return { ...prospect, alreadyExists: Boolean(duplicate), existingLeadId: duplicate?.id ?? null };
    });

    let searchId = body.searchId ?? null;
    let returnedProspects = prospects;
    let totalUniqueCount = prospects.length;
    let totalGoogleCount = rawProspects.length;
    let totalPagesFetched = collected.pagesFetched;
    if (!body.pageToken) {
      const { data: search, error } = await supabase.from("crm_searches").insert({
        city, business_type: businessType, query, result_count: prospects.length, google_result_count: rawProspects.length,
        pages_fetched: collected.pagesFetched, imported_count: 0, results: prospects,
        next_page_token: collected.nextPageToken, created_by: user.id
      }).select("id").single();
      if (error) throw error;
      searchId = search.id;
    } else if (searchId) {
      const { data: existing, error } = await supabase.from("crm_searches").select("results,result_count,google_result_count,pages_fetched").eq("id", searchId).single();
      if (error) throw error;
      const previous = (existing?.results ?? []) as PlacesProspect[];
      const combined = dedupeProspects([...previous, ...prospects]);
      returnedProspects = combined.slice(previous.length);
      totalUniqueCount = combined.length;
      totalGoogleCount = (existing.google_result_count ?? existing.result_count ?? 0) + rawProspects.length;
      totalPagesFetched = (existing.pages_fetched ?? 0) + collected.pagesFetched;
      const { error: updateError } = await supabase.from("crm_searches").update({
        results: combined, result_count: combined.length, google_result_count: totalGoogleCount,
        pages_fetched: totalPagesFetched, next_page_token: collected.nextPageToken
      }).eq("id", searchId);
      if (updateError) throw updateError;
    }

    let linkedCount = 0;
    if (searchId) {
      const relations = returnedProspects.filter((item) => item.existingLeadId).map((item) => ({ search_id: searchId, lead_id: item.existingLeadId! }));
      if (relations.length) {
        const { error: relationError } = await supabase.from("crm_search_leads").upsert(relations, { onConflict: "search_id,lead_id", ignoreDuplicates: true });
        if (relationError) throw relationError;
      }
      const { count } = await supabase.from("crm_search_leads").select("*", { count: "exact", head: true }).eq("search_id", searchId);
      linkedCount = count ?? 0;
      await supabase.from("crm_searches").update({ imported_count: linkedCount }).eq("id", searchId);
    }

    return NextResponse.json({
      prospects: returnedProspects, searchId, nextPageToken: collected.nextPageToken,
      googleResultCount: totalGoogleCount, uniqueCount: totalUniqueCount, pagesFetched: totalPagesFetched,
      pageSize: GOOGLE_PLACES_PAGE_SIZE, maxPages: GOOGLE_PLACES_MAX_PAGES, linkedCount
    });
  } catch (error) {
    return crmErrorResponse(error);
  }
}
