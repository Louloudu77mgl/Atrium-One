import { NextResponse, type NextRequest } from "next/server";
import { CRM_OPPORTUNITY_STATUSES } from "@/lib/crm/types";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, supabase } = await getCrmContext();
    const { id } = await params;
    const body = await request.json();
    const mrr = Number(body.mrr);
    if (!Number.isFinite(mrr) || mrr < 0) return NextResponse.json({ error: { message: "MRR invalide." } }, { status: 400 });
    const { data: lead, error: leadError } = await supabase.from("crm_leads").select("name").eq("id", id).single();
    if (leadError) throw leadError;
    const status = CRM_OPPORTUNITY_STATUSES.includes(body.status) && !['Gagnée', 'Perdue'].includes(body.status) ? body.status : "Ouverte";
    const { data, error } = await supabase.from("crm_opportunities").insert({
      lead_id: id, name: cleanText(body.name, 250) ?? `AtriumOne - ${lead.name}`, status, mrr,
      notes: cleanText(body.notes, 5000), created_by: user.id
    }).select("*").single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return crmErrorResponse(error); }
}
