import { NextResponse, type NextRequest } from "next/server";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await getCrmContext();
    const body = await request.json() as { action?: string; taskIds?: string[]; dueDate?: string; dueTime?: string };
    const taskIds = [...new Set(body.taskIds ?? [])].filter((id) => uuidPattern.test(id)).slice(0, 500);
    if (!taskIds.length) return NextResponse.json({ error: { code: "EMPTY_SELECTION", message: "Sélection vide." } }, { status: 400 });

    if (body.action === "complete") {
      const completedAt = new Date().toISOString();
      const { data, error } = await supabase.from("crm_tasks").update({ completed: true, completed_at: completedAt }).in("id", taskIds).eq("completed", false).select("id");
      if (error) throw error;
      return NextResponse.json({ updated: data?.length ?? 0, action: "complete" });
    }

    if (body.action === "delete") {
      const { data, error } = await supabase.from("crm_tasks").delete().in("id", taskIds).select("id");
      if (error) throw error;
      return NextResponse.json({ updated: data?.length ?? 0, action: "delete" });
    }

    if (body.action === "reschedule") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate ?? "")) return NextResponse.json({ error: { code: "INVALID_DATE", message: "Date obligatoire." } }, { status: 400 });
      const dueTime = /^\d{2}:\d{2}$/.test(body.dueTime ?? "") ? body.dueTime : null;
      const { data, error } = await supabase.from("crm_tasks").update({ due_date: body.dueDate, due_time: dueTime }).in("id", taskIds).eq("completed", false).select("*");
      if (error) throw error;
      return NextResponse.json({ updated: data?.length ?? 0, tasks: data ?? [], action: "reschedule" });
    }

    return NextResponse.json({ error: { code: "INVALID_BULK_ACTION", message: "Action groupée inconnue." } }, { status: 400 });
  } catch (error) {
    return crmErrorResponse(error);
  }
}
