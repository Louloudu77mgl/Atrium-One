import { NextResponse } from "next/server";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";

const TIMELINE_TYPES = ["call_completed", "task_completed", "r1_completed", "r2_completed", "r3_completed", "followup_completed", "appointment_created"];

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const { data, error } = await supabase.from("crm_activity").select("*").eq("lead_id", id).in("type", TIMELINE_TYPES).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) { return crmErrorResponse(error); }
}
