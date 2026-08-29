import { NextResponse, type NextRequest } from "next/server";
import { COMMERCIAL_STATUSES, LOST_REASONS } from "@/lib/crm/types";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

const textFields = ["name", "business_type", "address", "city", "postal_code", "phone", "email", "website", "signed_offer", "signed_comment", "lost_comment"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    for (const field of textFields) if (field in body) update[field] = cleanText(body[field], field === "signed_comment" || field === "lost_comment" ? 5000 : 500);
    if (typeof body.commercial_status === "string" && COMMERCIAL_STATUSES.includes(body.commercial_status as never)) update.commercial_status = body.commercial_status;
    if (typeof body.email_source === "string" && ["website", "manual", "unavailable", "account"].includes(body.email_source)) update.email_source = body.email_source;
    for (const field of ["signed_at", "contract_started_at", "lost_at", "archived_at", "deleted_at"] as const) if (field in body) update[field] = body[field] || null;
    for (const field of ["monthly_value", "mrr"] as const) if (field in body) update[field] = body[field] === null || body[field] === "" ? null : Number(body[field]);
    if (typeof body.lost_reason === "string" && LOST_REASONS.includes(body.lost_reason as never)) update.lost_reason = body.lost_reason;
    if (!Object.keys(update).length) return NextResponse.json({ error: { code: "NO_CHANGES", message: "Aucune modification valide." } }, { status: 400 });
    const { data, error } = await supabase.from("crm_leads").update(update).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return crmErrorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const permanent = new URL(request.url).searchParams.get("permanent") === "1";
    const { data: lead } = await supabase.from("crm_leads").select("business_id").eq("id", id).maybeSingle();
    if (permanent && lead?.business_id && new URL(request.url).searchParams.get("confirm_account_preserved") !== "1") {
      return NextResponse.json({ error: { code: "ACCOUNT_LINKED", message: "Ce lead possède un compte AtriumOne. Le compte ne sera pas supprimé." } }, { status: 409 });
    }
    const operation = permanent ? supabase.from("crm_leads").delete().eq("id", id) : supabase.from("crm_leads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    const { error } = await operation;
    if (error) throw error;
    if (!permanent) {
      const { error: taskError } = await supabase.from("crm_tasks").delete().eq("lead_id", id);
      if (taskError) throw taskError;
    }
    return NextResponse.json({ ok: true, accountPreserved: Boolean(lead?.business_id) });
  } catch (error) { return crmErrorResponse(error); }
}
