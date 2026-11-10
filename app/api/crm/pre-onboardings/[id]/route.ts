import { NextResponse, type NextRequest } from "next/server";
import { PRE_ONBOARDING_STATUSES } from "@/lib/crm/pre-onboarding";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    if (typeof body.status === "string" && PRE_ONBOARDING_STATUSES.includes(body.status as never)) update.status = body.status;
    for (const field of ["google_configured", "gmail_configured", "instagram_configured"] as const) if (typeof body[field] === "boolean") update[field] = body[field];
    if (!Object.keys(update).length) return NextResponse.json({ error: { code: "NO_CHANGES", message: "Aucune modification valide." } }, { status: 400 });
    const { data, error } = await supabase.from("crm_pre_onboardings").update(update).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return crmErrorResponse(error); }
}
