import { NextResponse, type NextRequest } from "next/server";
import { buildEventTitle } from "@/lib/crm/logic";
import { CRM_CALL_RESULTS, CRM_EVENT_TYPES } from "@/lib/crm/types";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const body = await request.json();
    const update: Record<string, unknown> = {};
    for (const key of ["event_date", "event_time"] as const) if (key in body) update[key] = body[key] || null;
    for (const key of ["notes", "result"] as const) if (key in body) update[key] = cleanText(body[key], 5000);
    if ("duration_minutes" in body) update.duration_minutes = body.duration_minutes ? Math.max(5, Math.min(1440, Number(body.duration_minutes))) : null;
    if (body.call_result === "" || CRM_CALL_RESULTS.includes(body.call_result)) update.call_result = body.call_result || null;
    if (CRM_EVENT_TYPES.includes(body.type)) {
      const { data: event, error: eventError } = await supabase.from("crm_events").select("lead_id,crm_leads(name)").eq("id", id).single();
      if (eventError) throw eventError;
      const leadName = (event.crm_leads as { name?: string } | null)?.name ?? "Prospect";
      update.type = body.type;
      update.title = buildEventTitle(body.type, leadName);
    }
    const { data, error } = await supabase.from("crm_events").update(update).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return crmErrorResponse(error); }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const { error } = await supabase.from("crm_events").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return crmErrorResponse(error); }
}
