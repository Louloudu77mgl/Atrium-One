import { NextResponse } from "next/server";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const { error } = await supabase.from("crm_searches").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return crmErrorResponse(error); }
}
