import { NextResponse, type NextRequest } from "next/server";
import { CRM_MODULES } from "@/lib/crm/types";
import { crmErrorResponse, getCrmContext } from "@/lib/crm/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, supabase } = await getCrmContext();
    const { id } = await params;
    const body = await request.json() as { businessId?: string; accountEnabled?: boolean; onboardingStatus?: string; modules?: Record<string, boolean>; manualConfirmed?: boolean };
    const { data: lead, error: leadError } = await supabase.from("crm_leads").select("business_id,auth_user_id").eq("id", id).single();
    if (leadError) throw leadError;
    let businessId = lead.business_id as string | null;
    if (!businessId && body.businessId) {
      if (!body.manualConfirmed) return NextResponse.json({ error: { code: "CONFIRM_ASSOCIATION", message: "Confirmez l’association manuelle." } }, { status: 409 });
      const admin = createSupabaseAdminClient();
      const { data: merchant, error } = await admin.from("merchants").select("id,user_id").eq("id", body.businessId).single();
      if (error) throw error;
      const { error: updateError } = await supabase.from("crm_leads").update({ business_id: merchant.id, auth_user_id: merchant.user_id, email_source: "account" }).eq("id", id);
      if (updateError) throw updateError;
      businessId = merchant.id;
      await supabase.from("crm_activity").insert({ lead_id: id, type: "account_associated", metadata: { business_id: merchant.id }, created_by: user.id });
    }
    if (!businessId) return NextResponse.json({ error: { code: "NO_ACCOUNT", message: "Aucun compte AtriumOne associé." } }, { status: 400 });

    const { data: previous } = await supabase.from("business_access").select("account_enabled").eq("business_id", businessId).maybeSingle();
    const onboardingStatus = body.onboardingStatus === "suspended" ? "suspended" : body.accountEnabled ? "active" : "pending";
    const enabled = Boolean(body.accountEnabled) && onboardingStatus !== "suspended";
    const { error: accessError } = await supabase.from("business_access").upsert({
      business_id: businessId, account_enabled: enabled, onboarding_status: onboardingStatus,
      enabled_at: enabled ? new Date().toISOString() : null, enabled_by: enabled ? user.id : null,
      disabled_at: enabled ? null : new Date().toISOString()
    }, { onConflict: "business_id" });
    if (accessError) throw accessError;

    const moduleRows = CRM_MODULES.map((moduleKey) => ({ business_id: businessId, module_key: moduleKey, enabled: Boolean(body.modules?.[moduleKey]), enabled_at: Boolean(body.modules?.[moduleKey]) ? new Date().toISOString() : null, enabled_by: Boolean(body.modules?.[moduleKey]) ? user.id : null }));
    const { error: moduleError } = await supabase.from("business_module_access").upsert(moduleRows, { onConflict: "business_id,module_key" });
    if (moduleError) throw moduleError;
    if (!previous?.account_enabled && enabled) await supabase.from("crm_activity").insert({ lead_id: id, type: "account_activated", metadata: { modules: moduleRows.filter((row) => row.enabled).map((row) => row.module_key) }, created_by: user.id });
    if (previous?.account_enabled && !enabled) await supabase.from("crm_activity").insert({ lead_id: id, type: "account_disabled", metadata: {}, created_by: user.id });
    return NextResponse.json({ businessId, accountEnabled: enabled, onboardingStatus, modules: Object.fromEntries(moduleRows.map((row) => [row.module_key, row.enabled])) });
  } catch (error) { return crmErrorResponse(error); }
}
