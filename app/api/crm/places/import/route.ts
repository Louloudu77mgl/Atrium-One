import { NextResponse, type NextRequest } from "next/server";
import { enrichPublicEmail } from "@/lib/crm/email-enrichment";
import { crmErrorResponse, findDuplicate, getCrmContext } from "@/lib/crm/server";
import type { CrmLead, PlacesProspect } from "@/lib/crm/types";

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await getCrmContext();
    const { prospects, searchId } = await request.json() as { prospects?: PlacesProspect[]; searchId?: string };
    if (!Array.isArray(prospects) || prospects.length === 0 || prospects.length > 100) return NextResponse.json({ error: { code: "INVALID_SELECTION", message: "Sélection invalide." } }, { status: 400 });
    const { data: rows } = await supabase.from("crm_leads").select("id,google_place_id,website,phone,name,address").is("deleted_at", null);
    const known = (rows ?? []) as Array<Pick<CrmLead, "id" | "google_place_id" | "website" | "phone" | "name" | "address">>;
    const imported: Array<{ placeId: string; leadId: string; email: string | null }> = [];
    const duplicates: Array<{ placeId: string; leadId: string }> = [];

    for (let index = 0; index < prospects.length; index += 3) {
      const batch = prospects.slice(index, index + 3);
      const enriched = await Promise.all(batch.map(async (prospect) => ({ prospect, enrichment: await enrichPublicEmail(prospect.website) })));
      for (const { prospect, enrichment } of enriched) {
        const duplicate = findDuplicate(known, prospect);
        if (duplicate) { duplicates.push({ placeId: prospect.placeId, leadId: duplicate.id }); continue; }
        const { data: lead, error } = await supabase.from("crm_leads").insert({
          name: prospect.name, business_type: prospect.businessType, address: prospect.address, city: prospect.city, postal_code: prospect.postalCode,
          phone: prospect.phone, email: enrichment.email, email_source: enrichment.source, website: prospect.website,
          google_place_id: prospect.placeId || null, google_maps_url: prospect.googleMapsUrl, google_rating: prospect.rating,
          google_reviews_count: prospect.reviewsCount, google_profile_created_at: null, latitude: prospect.latitude, longitude: prospect.longitude,
          google_business_status: prospect.businessStatus, lead_source: "Google Prospection", commercial_status: "Nouveau"
        }).select("id").single();
        if (error) {
          if (error.code === "23505") continue;
          throw error;
        }
        known.push({ id: lead.id, google_place_id: prospect.placeId, website: prospect.website, phone: prospect.phone, name: prospect.name, address: prospect.address });
        imported.push({ placeId: prospect.placeId, leadId: lead.id, email: enrichment.email });
      }
    }
    if (searchId && imported.length) {
      const { data: search } = await supabase.from("crm_searches").select("imported_count").eq("id", searchId).maybeSingle();
      await supabase.from("crm_searches").update({ imported_count: (search?.imported_count ?? 0) + imported.length }).eq("id", searchId);
    }
    return NextResponse.json({ imported, duplicates });
  } catch (error) { return crmErrorResponse(error); }
}
