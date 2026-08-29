import { NextResponse, type NextRequest } from "next/server";
import { distributeProspectsAcrossDays } from "@/lib/crm/logic";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const excludedStatuses = new Set(["Client", "Signé", "Perdu"]);

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getCrmContext();
    const body = await request.json() as { dates?: string[]; prospectsPerDay?: number };
    const dates = [...new Set(body.dates ?? [])]
      .filter((date) => datePattern.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime()))
      .sort()
      .slice(0, 14);
    const prospectsPerDay = Math.min(200, Math.max(1, Math.floor(Number(body.prospectsPerDay ?? 0))));
    if (!dates.length) return NextResponse.json({ error: { code: "EMPTY_DATES", message: "Sélectionnez au moins une date." } }, { status: 400 });
    if (!Number.isFinite(prospectsPerDay)) return NextResponse.json({ error: { code: "INVALID_QUOTA", message: "Quota journalier invalide." } }, { status: 400 });

    const [{ data: leads, error: leadError }, { data: pendingCalls, error: taskError }] = await Promise.all([
      supabase.from("crm_leads").select("id,name,city,phone,email,business_type,commercial_status,google_reviews_count,created_at").is("deleted_at", null).is("archived_at", null).order("google_reviews_count", { ascending: false, nullsFirst: false }).order("created_at").limit(1000),
      supabase.from("crm_tasks").select("lead_id").eq("type", "Appel").eq("completed", false).limit(5000)
    ]);
    if (leadError) throw leadError;
    if (taskError) throw taskError;

    const alreadyPlanned = new Set((pendingCalls ?? []).map((task: { lead_id: string }) => task.lead_id));
    const requested = dates.length * prospectsPerDay;
    const eligible = (leads ?? []).filter((lead: { id: string; phone: string | null; commercial_status: string }) => Boolean(lead.phone) && !excludedStatuses.has(lead.commercial_status) && !alreadyPlanned.has(lead.id)).slice(0, requested);
    if (!eligible.length) return NextResponse.json({ error: { code: "NO_ELIGIBLE_LEADS", message: "Aucun prospect joignable sans appel en attente n’est disponible." } }, { status: 409 });

    const allocation = distributeProspectsAcrossDays(eligible, dates, prospectsPerDay, user.id);
    const { data: created, error: insertError } = await supabase.from("crm_tasks").insert(allocation.rows).select("*");
    if (insertError) throw insertError;
    const leadById = new Map(eligible.map((lead: { id: string }) => [lead.id, lead]));

    return NextResponse.json({
      created: created?.length ?? 0,
      requested,
      shortage: Math.max(0, requested - (created?.length ?? 0)),
      counts: allocation.counts,
      dates,
      tasks: (created ?? []).map((task: { lead_id: string }) => ({ ...task, crm_leads: leadById.get(task.lead_id) ?? null }))
    }, { status: 201 });
  } catch (error) {
    return crmErrorResponse(error);
  }
}
