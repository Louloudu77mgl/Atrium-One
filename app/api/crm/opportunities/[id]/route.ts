import { NextResponse, type NextRequest } from "next/server";
import { CRM_OPPORTUNITY_STATUSES } from "@/lib/crm/types";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const body = await request.json();
    if (['Gagnée', 'Perdue'].includes(body.status)) {
      const { data, error } = await supabase.rpc("close_crm_opportunity", { target_opportunity_id: id, target_status: body.status, target_lost_reason: cleanText(body.lost_reason, 500) });
      if (error) throw error;
      return NextResponse.json(Array.isArray(data) ? data[0] : data);
    }
    const update: Record<string, unknown> = {};
    if ("name" in body) update.name = cleanText(body.name, 250);
    if ("notes" in body) update.notes = cleanText(body.notes, 5000);
    if ("mrr" in body && Number.isFinite(Number(body.mrr)) && Number(body.mrr) >= 0) update.mrr = Number(body.mrr);
    if (CRM_OPPORTUNITY_STATUSES.includes(body.status)) update.status = body.status;
    const { data, error } = await supabase.from("crm_opportunities").update(update).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return crmErrorResponse(error); }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const { error } = await supabase.from("crm_opportunities").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return crmErrorResponse(error); }
}
