import { NextResponse, type NextRequest } from "next/server";
import { buildBulkTaskRows } from "@/lib/crm/logic";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getCrmContext();
    const body = await request.json() as { action?: string; leadIds?: string[]; type?: string; dueDate?: string; dueTime?: string; description?: string };
    const leadIds = [...new Set(body.leadIds ?? [])].filter((id) => uuidPattern.test(id)).slice(0, 200);
    if (!leadIds.length) return NextResponse.json({ error: { code: "EMPTY_SELECTION", message: "Sélection vide." } }, { status: 400 });

    const { data: leads, error: leadError } = await supabase.from("crm_leads").select("id,name").in("id", leadIds).is("deleted_at", null);
    if (leadError) throw leadError;
    if (!leads?.length) return NextResponse.json({ error: { code: "LEADS_NOT_FOUND", message: "Aucun prospect actif trouvé." } }, { status: 404 });

    if (body.action === "archive") {
      const { error } = await supabase.from("crm_leads").update({ archived_at: new Date().toISOString() }).in("id", leads.map((lead: { id: string }) => lead.id));
      if (error) throw error;
      return NextResponse.json({ updated: leads.length, action: "archive" });
    }

    if (body.action === "delete") {
      const ids = leads.map((lead: { id: string }) => lead.id);
      const { error } = await supabase.from("crm_leads").update({ deleted_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
      const { error: taskError } = await supabase.from("crm_tasks").delete().in("lead_id", ids);
      if (taskError) throw taskError;
      return NextResponse.json({ updated: leads.length, action: "delete", accountsPreserved: true });
    }

    if (body.action === "task") {
      if (!['Appel', 'Email'].includes(body.type ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate ?? "")) return NextResponse.json({ error: { code: "INVALID_TASK", message: "Type Appel/Email et date obligatoires." } }, { status: 400 });
      const rows = buildBulkTaskRows(leads, {
        type: body.type as "Appel" | "Email", dueDate: body.dueDate!, dueTime: body.dueTime || null,
        description: cleanText(body.description, 5000), createdBy: user.id
      });
      const { error } = await supabase.from("crm_tasks").insert(rows);
      if (error) throw error;
      return NextResponse.json({ created: rows.length, action: "task" }, { status: 201 });
    }

    return NextResponse.json({ error: { code: "INVALID_BULK_ACTION", message: "Action bulk inconnue." } }, { status: 400 });
  } catch (error) {
    return crmErrorResponse(error);
  }
}
