import { NextResponse, type NextRequest } from "next/server";
import { buildTaskTitle } from "@/lib/crm/logic";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const body = await request.json();
    const update: Record<string, unknown> = {};
    if ("description" in body) update.description = cleanText(body.description, 5000);
    if ("due_date" in body) update.due_date = body.due_date;
    if ("due_time" in body) update.due_time = body.due_time || null;
    if (typeof body.completed === "boolean") { update.completed = body.completed; update.completed_at = body.completed ? new Date().toISOString() : null; }
    if (['Appel', 'Email'].includes(body.type)) {
      const { data: task, error: taskError } = await supabase.from("crm_tasks").select("lead_id,crm_leads(name)").eq("id", id).single();
      if (taskError) throw taskError;
      const leadName = (task.crm_leads as { name?: string } | null)?.name ?? "Prospect";
      update.type = body.type;
      update.title = buildTaskTitle(body.type, leadName);
    }
    const { data, error } = await supabase.from("crm_tasks").update(update).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return crmErrorResponse(error); }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const { error } = await supabase.from("crm_tasks").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return crmErrorResponse(error); }
}
