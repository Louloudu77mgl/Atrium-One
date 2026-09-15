import { NextResponse, type NextRequest } from "next/server";
import { cleanText, CrmApiError, crmErrorResponse, getCrmContext } from "@/lib/crm/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await getCrmContext();
    const { id } = await params;
    const { data: lead, error } = await supabase.from("crm_leads").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!lead) throw new CrmApiError(404, "LEAD_NOT_FOUND", "Fiche client introuvable.");
    if (!lead.auth_user_id) throw new CrmApiError(409, "NO_SIGNUP", "Ce prospect doit d’abord créer son compte AtriumOne.");

    const admin = createSupabaseAdminClient();
    const { data: account, error: accountError } = await admin.auth.admin.getUserById(lead.auth_user_id);
    if (accountError || !account.user) throw new CrmApiError(409, "NO_SIGNUP", "Le compte de cette inscription est introuvable.");
    const { data: existing, error: merchantError } = await admin.from("merchants").select("id").eq("user_id", lead.auth_user_id).maybeSingle();
    if (merchantError) throw merchantError;
    let businessId = existing?.id;
    if (!businessId) {
      const body = await request.json();
      const businessName = cleanText(body.businessName, 120);
      const businessType = cleanText(body.businessType, 80);
      const city = cleanText(body.city, 100);
      if (!businessName || !businessType || !city) throw new CrmApiError(400, "BUSINESS_REQUIRED", "Renseignez le nom du commerce, son activité et sa ville.");
      // Never overwrite an onboarding completed concurrently by the client.
      const { error: insertError } = await admin.from("merchants").upsert({
        user_id: lead.auth_user_id, business_name: businessName, business_type: businessType,
        city, phone: lead.phone, website_url: lead.website
      }, { onConflict: "user_id", ignoreDuplicates: true });
      if (insertError) throw insertError;
      const { data: created, error: createdError } = await admin.from("merchants").select("id").eq("user_id", lead.auth_user_id).single();
      if (createdError) throw createdError;
      businessId = created.id;
    }
    // The signup trigger normally links the lead; this also repairs an older unlinked signup.
    const { data: updated, error: updateError } = await supabase.from("crm_leads")
      .update({ business_id: businessId }).eq("id", id).eq("auth_user_id", lead.auth_user_id)
      .is("deleted_at", null).select("*").single();
    if (updateError) throw updateError;
    const [{ data: access, error: accessError }, { data: modules, error: modulesError }] = await Promise.all([
      supabase.from("business_access").select("*").eq("business_id", businessId).maybeSingle(),
      supabase.from("business_module_access").select("module_key,enabled").eq("business_id", businessId)
    ]);
    if (accessError) throw accessError;
    if (modulesError) throw modulesError;
    return NextResponse.json({ lead: updated, access, modules: modules ?? [] });
  } catch (error) { return crmErrorResponse(error); }
}
