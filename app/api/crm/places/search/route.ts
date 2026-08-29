import { NextResponse, type NextRequest } from "next/server";
import { crmErrorResponse, findDuplicate, getCrmContext } from "@/lib/crm/server";
import type { CrmLead, PlacesProspect } from "@/lib/crm/types";

type GooglePlace = {
  id?: string; displayName?: { text?: string }; primaryTypeDisplayName?: { text?: string }; formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
  nationalPhoneNumber?: string; internationalPhoneNumber?: string; websiteUri?: string; rating?: number; userRatingCount?: number;
  googleMapsUri?: string; location?: { latitude?: number; longitude?: number }; businessStatus?: string;
};

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
    const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.primaryTypeDisplayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.location,places.businessStatus,nextPageToken"
      },
      body: JSON.stringify({ textQuery: query, languageCode: "fr", regionCode: "FR", pageSize: 20, ...(body.pageToken ? { pageToken: body.pageToken } : {}) }),
      signal: AbortSignal.timeout(12000)
    });
    const googleData = await googleResponse.json() as { places?: GooglePlace[]; nextPageToken?: string; error?: { message?: string; status?: string } };
    if (!googleResponse.ok) {
      const quota = googleResponse.status === 429 || googleData.error?.status === "RESOURCE_EXHAUSTED";
      return NextResponse.json({ error: { code: quota ? "PLACES_QUOTA" : "PLACES_ERROR", message: quota ? "Quota Google Places atteint. Réessayez plus tard." : "Google Places n’a pas pu terminer la recherche." } }, { status: quota ? 429 : 502 });
    }

    const { data: leadRows } = await supabase.from("crm_leads").select("id,google_place_id,website,phone,name,address").is("deleted_at", null);
    const leads = (leadRows ?? []) as Array<Pick<CrmLead, "id" | "google_place_id" | "website" | "phone" | "name" | "address">>;
    const prospects: PlacesProspect[] = (googleData.places ?? []).map((place) => {
      const base: PlacesProspect = {
        placeId: place.id ?? "", name: place.displayName?.text ?? "Établissement", businessType: place.primaryTypeDisplayName?.text ?? businessType,
        address: place.formattedAddress ?? null, city: addressPart(place, "locality") ?? addressPart(place, "postal_town") ?? city,
        postalCode: addressPart(place, "postal_code"), phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
        email: null, emailSource: "unavailable", website: place.websiteUri ?? null, rating: place.rating ?? null,
        reviewsCount: place.userRatingCount ?? null, googleMapsUrl: place.googleMapsUri ?? null,
        latitude: place.location?.latitude ?? null, longitude: place.location?.longitude ?? null,
        businessStatus: place.businessStatus ?? null, alreadyExists: false, existingLeadId: null
      };
      const duplicate = findDuplicate(leads, base);
      return { ...base, alreadyExists: Boolean(duplicate), existingLeadId: duplicate?.id ?? null };
    });

    let searchId = body.searchId ?? null;
    if (!body.pageToken) {
      const { data: search, error } = await supabase.from("crm_searches").insert({ city, business_type: businessType, query, result_count: prospects.length, imported_count: 0, results: prospects, next_page_token: googleData.nextPageToken ?? null, created_by: user.id }).select("id").single();
      if (error) throw error;
      searchId = search.id;
    } else if (searchId) {
      const { data: existing } = await supabase.from("crm_searches").select("results,result_count").eq("id", searchId).single();
      const combined = [...((existing?.results ?? []) as PlacesProspect[]), ...prospects];
      await supabase.from("crm_searches").update({ results: combined, result_count: combined.length, next_page_token: googleData.nextPageToken ?? null }).eq("id", searchId);
    }

    return NextResponse.json({ prospects, searchId, nextPageToken: googleData.nextPageToken ?? null });
  } catch (error) {
    return crmErrorResponse(error);
  }
}
