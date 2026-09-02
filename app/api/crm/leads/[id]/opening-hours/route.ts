import { NextResponse } from "next/server";
import { CrmApiError, crmErrorResponse, getCrmContext } from "@/lib/crm/server";
import type { GoogleOpeningHours } from "@/lib/crm/types";

type GooglePlaceDetails = { regularOpeningHours?: GoogleOpeningHours; error?: { status?: string } };

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new CrmApiError(503, "PLACES_NOT_CONFIGURED", "Google Places n’est pas configuré.");

    const { data: lead, error: leadError } = await supabase.from("crm_leads").select("google_place_id").eq("id", id).is("deleted_at", null).maybeSingle();
    if (leadError) throw leadError;
    if (!lead?.google_place_id) throw new CrmApiError(409, "NO_PLACE_ID", "Ce commerce n’a pas de fiche Google associée.");

    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(lead.google_place_id)}`, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "regularOpeningHours" },
      signal: AbortSignal.timeout(12000)
    });
    const place = await response.json() as GooglePlaceDetails;
    if (!response.ok) {
      const quota = response.status === 429 || place.error?.status === "RESOURCE_EXHAUSTED";
      throw new CrmApiError(quota ? 429 : 502, quota ? "PLACES_QUOTA" : "PLACES_ERROR", quota ? "Quota Google Places atteint." : "Les horaires Google n’ont pas pu être récupérés.");
    }

    const openingHours = place.regularOpeningHours ?? {};
    const { error: updateError } = await supabase.from("crm_leads").update({ google_opening_hours: openingHours }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ openingHours });
  } catch (error) {
    return crmErrorResponse(error);
  }
}
