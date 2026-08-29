import { NextResponse, type NextRequest } from "next/server";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const { data, error } = await supabase.from("crm_activity").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Entrée introuvable." } }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return crmErrorResponse(error); }
}
