import { NextResponse } from "next/server";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const { data, error } = await supabase.rpc("delete_crm_search_with_exclusive_leads", { target_search_id: id });
    if (error) throw error;
    return NextResponse.json({ ok: true, ...(data ?? {}) });
  } catch (error) { return crmErrorResponse(error); }
}
