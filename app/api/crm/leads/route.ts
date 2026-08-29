import { NextResponse, type NextRequest } from "next/server";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await getCrmContext();
    const body = await request.json() as Record<string, unknown>;
    const name = cleanText(body.name, 180);
    if (!name) return NextResponse.json({ error: { code: "NAME_REQUIRED", message: "Le nom est requis." } }, { status: 400 });
    const { data, error } = await supabase.from("crm_leads").insert({
      name, business_type: cleanText(body.business_type, 120), address: cleanText(body.address), city: cleanText(body.city, 100),
      postal_code: cleanText(body.postal_code, 20), phone: cleanText(body.phone, 50), email: cleanText(body.email, 250)?.toLowerCase() ?? null,
      email_source: body.email ? "manual" : "unavailable", website: cleanText(body.website), lead_source: "Manuel", commercial_status: "Nouveau"
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return crmErrorResponse(error); }
}
