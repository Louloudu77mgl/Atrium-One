import { NextResponse, type NextRequest } from "next/server";
import { buildEventTitle } from "@/lib/crm/logic";
import { CRM_CALL_RESULTS, CRM_EVENT_TYPES } from "@/lib/crm/types";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, supabase } = await getCrmContext();
    const { id } = await params;
    const body = await request.json();
    if (!CRM_EVENT_TYPES.includes(body.type) || !/^\d{4}-\d{2}-\d{2}$/.test(body.event_date ?? "")) return NextResponse.json({ error: { message: "Type et date requis." } }, { status: 400 });
    if (body.type !== "Appel effectué" && !/^\d{2}:\d{2}/.test(body.event_time ?? "")) return NextResponse.json({ error: { message: "L’heure est requise pour un rendez-vous." } }, { status: 400 });
    if (body.type === "Appel effectué" && body.call_result && !CRM_CALL_RESULTS.includes(body.call_result)) return NextResponse.json({ error: { message: "Résultat d’appel invalide." } }, { status: 400 });
    const { data: lead, error: leadError } = await supabase.from("crm_leads").select("name").eq("id", id).single();
    if (leadError) throw leadError;
    const duration = body.duration_minutes ? Math.max(5, Math.min(1440, Number(body.duration_minutes))) : null;
    const { data, error } = await supabase.from("crm_events").insert({
      lead_id: id, title: buildEventTitle(body.type, lead.name), type: body.type, event_date: body.event_date,
      event_time: body.event_time || null, duration_minutes: Number.isFinite(duration) ? duration : null,
      call_result: body.type === "Appel effectué" ? cleanText(body.call_result, 100) : null,
      notes: cleanText(body.notes, 5000), result: cleanText(body.result, 2000), created_by: user.id
    }).select("*").single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return crmErrorResponse(error); }
}
