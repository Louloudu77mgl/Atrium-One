import { NextResponse, type NextRequest } from "next/server";
import { distributeProspectsAcrossDaysMatching } from "@/lib/crm/logic";
import { hasOpeningHours, isOpenAtDate } from "@/lib/crm/opening-hours";
import type { GoogleOpeningHours } from "@/lib/crm/types";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const excludedStatuses = new Set(["Client", "Signé", "Perdu"]);

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getCrmContext();
    const body = await request.json() as { dates?: string[]; prospectsPerDay?: number; filters?: { city?: string; businessType?: string; status?: string; source?: string; minRating?: string | number; minReviews?: string | number; email?: string; website?: string; openingTime?: string } };
    const dates = [...new Set(body.dates ?? [])]
      .filter((date) => datePattern.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime()))
      .sort()
      .slice(0, 14);
    const prospectsPerDay = Math.min(200, Math.max(1, Math.floor(Number(body.prospectsPerDay ?? 0))));
    if (!dates.length) return NextResponse.json({ error: { code: "EMPTY_DATES", message: "Sélectionnez au moins une date." } }, { status: 400 });
    if (!Number.isFinite(prospectsPerDay)) return NextResponse.json({ error: { code: "INVALID_QUOTA", message: "Quota journalier invalide." } }, { status: 400 });
    const filters = {
      city: String(body.filters?.city ?? "").trim().slice(0, 200),
      businessType: String(body.filters?.businessType ?? "").trim().slice(0, 200),
      status: String(body.filters?.status ?? "").trim().slice(0, 100),
      source: String(body.filters?.source ?? "").trim().slice(0, 100),
      minRating: Math.max(0, Math.min(5, Number(body.filters?.minRating) || 0)),
      minReviews: Math.max(0, Math.floor(Number(body.filters?.minReviews) || 0)),
      email: ["yes", "no"].includes(body.filters?.email ?? "") ? body.filters!.email : "all",
      website: ["yes", "no"].includes(body.filters?.website ?? "") ? body.filters!.website : "all",
      openingTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(body.filters?.openingTime ?? "") ? body.filters!.openingTime! : ""
    };

    const [{ data: leads, error: leadError }, { data: pendingCalls, error: taskError }] = await Promise.all([
      supabase.from("crm_leads").select("id,name,city,phone,email,website,business_type,commercial_status,lead_source,google_rating,google_reviews_count,google_opening_hours,created_at").is("deleted_at", null).is("archived_at", null).order("google_reviews_count", { ascending: false, nullsFirst: false }).order("created_at").limit(1000),
      supabase.from("crm_tasks").select("lead_id").eq("type", "Appel").eq("completed", false).limit(5000)
    ]);
    if (leadError) throw leadError;
    if (taskError) throw taskError;

    const alreadyPlanned = new Set((pendingCalls ?? []).map((task: { lead_id: string }) => task.lead_id));
    const requested = dates.length * prospectsPerDay;
    type PlannerLead = { id: string; name: string; phone: string | null; email: string | null; website: string | null; city: string | null; business_type: string | null; commercial_status: string; lead_source: string; google_rating: number | null; google_reviews_count: number | null; google_opening_hours: GoogleOpeningHours | null };
    const eligible = (leads ?? []).filter((lead: PlannerLead) => {
      const presenceMatches = (value: string | null, mode: string) => mode === "all" || (mode === "yes" ? Boolean(value) : !value);
      return Boolean(lead.phone)
        && !excludedStatuses.has(lead.commercial_status)
        && !alreadyPlanned.has(lead.id)
        && (!filters.city || lead.city === filters.city)
        && (!filters.businessType || lead.business_type === filters.businessType)
        && (!filters.status || lead.commercial_status === filters.status)
        && (!filters.source || lead.lead_source === filters.source)
        && (lead.google_rating ?? 0) >= filters.minRating
        && (lead.google_reviews_count ?? 0) >= filters.minReviews
        && presenceMatches(lead.email, filters.email ?? "all")
        && presenceMatches(lead.website, filters.website ?? "all");
    }) as PlannerLead[];
    if (!eligible.length) return NextResponse.json({ error: { code: "NO_ELIGIBLE_LEADS", message: "Aucun prospect joignable sans appel en attente n’est disponible." } }, { status: 409 });

    const allocation = distributeProspectsAcrossDaysMatching(eligible, dates, prospectsPerDay, (lead, date) => !filters.openingTime || isOpenAtDate(lead.google_opening_hours, date, filters.openingTime), user.id);
    if (!allocation.rows.length) return NextResponse.json({ error: { code: "NO_OPEN_LEADS", message: `Aucun prospect avec des horaires Google confirmés n’est ouvert à ${filters.openingTime}.` } }, { status: 409 });
    const { data: created, error: insertError } = await supabase.from("crm_tasks").insert(allocation.rows).select("*");
    if (insertError) throw insertError;
    const leadById = new Map(eligible.map((lead: { id: string }) => [lead.id, lead]));

    return NextResponse.json({
      created: created?.length ?? 0,
      requested,
      shortage: Math.max(0, requested - (created?.length ?? 0)),
      counts: allocation.counts,
      dates,
      openingTime: filters.openingTime || null,
      unknownOpeningHours: filters.openingTime ? eligible.filter((lead) => !hasOpeningHours(lead.google_opening_hours)).length : 0,
      tasks: (created ?? []).map((task: { lead_id: string }) => ({ ...task, crm_leads: leadById.get(task.lead_id) ?? null }))
    }, { status: 201 });
  } catch (error) {
    return crmErrorResponse(error);
  }
}
