import { redirect } from "next/navigation";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";
import { CRM_ADMIN_EMAIL, type BusinessAccess, type CrmModule } from "@/lib/crm/types";
import { getMerchant } from "@/lib/merchants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export class BusinessAccessError extends Error {
  readonly code: "ACCOUNT_DISABLED" | "FEATURE_DISABLED" | "NO_BUSINESS";
  readonly status = 403;

  constructor(code: BusinessAccessError["code"]) {
    super(code === "FEATURE_DISABLED" ? "Cette fonctionnalité sera activée pendant votre onboarding." : "Votre espace AtriumOne doit être activé pendant votre onboarding.");
    this.code = code;
  }
}

export function isCrmAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === CRM_ADMIN_EMAIL;
}

export async function requireCrmAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isCrmAdminEmail(user.email)) redirect("/dashboard");
  return user;
}

export async function getOwnBusinessAccess(): Promise<{ access: BusinessAccess | null; modules: Record<string, boolean> }> {
  const merchant = await getMerchant();
  if (!merchant) return { access: null, modules: {} };
  const supabase = await createServerSupabaseClient();
  const [{ data: access, error }, { data: moduleRows }] = await Promise.all([
    supabase.from("business_access" as never).select("*").eq("business_id", merchant.id).maybeSingle(),
    supabase.from("business_module_access" as never).select("module_key,enabled").eq("business_id", merchant.id)
  ]);

  // Deployment compatibility: until the additive migration is applied, legacy accounts remain usable.
  if (error && "code" in error && error.code === "PGRST205") {
    return { access: { business_id: merchant.id, account_enabled: true, onboarding_status: "active", signup_source: "legacy", enabled_at: null, enabled_by: null, disabled_at: null, updated_at: merchant.created_at }, modules: Object.fromEntries(["reviews", "instagram", "hans", "automations", "emailing", "rcu", "customers", "insights"].map((key) => [key, true])) };
  }

  const modules = Object.fromEntries(((moduleRows ?? []) as Array<{ module_key: string; enabled: boolean }>).map((row) => [row.module_key, row.enabled]));
  return { access: access as BusinessAccess | null, modules };
}

export async function assertBusinessFeatureAccess(businessId: string, feature?: CrmModule) {
  const user = await getCurrentUser();
  if (!user) throw new BusinessAccessError("NO_BUSINESS");
  const merchant = await getMerchant(user.id);
  if (!merchant || merchant.id !== businessId) throw new BusinessAccessError("NO_BUSINESS");

  const supabase = await createServerSupabaseClient();
  const { data: access, error } = await supabase.from("business_access" as never).select("account_enabled").eq("business_id", businessId).maybeSingle();
  if (error && "code" in error && error.code === "PGRST205") return merchant;
  if (!(access as { account_enabled?: boolean } | null)?.account_enabled) throw new BusinessAccessError("ACCOUNT_DISABLED");

  if (feature) {
    const { data: moduleAccess } = await supabase.from("business_module_access" as never).select("enabled").eq("business_id", businessId).eq("module_key", feature).maybeSingle();
    if (!(moduleAccess as { enabled?: boolean } | null)?.enabled) throw new BusinessAccessError("FEATURE_DISABLED");
  }

  return merchant;
}

export async function hasBusinessFeatureAccessAdmin(businessId: string, feature: CrmModule) {
  const supabase = createSupabaseAdminClient() as any;
  const { data: access, error } = await supabase.from("business_access").select("account_enabled").eq("business_id", businessId).maybeSingle();
  if (error?.code === "PGRST205") return true;
  if (!access?.account_enabled) return false;
  const { data: moduleAccess, error: moduleError } = await supabase.from("business_module_access").select("enabled").eq("business_id", businessId).eq("module_key", feature).maybeSingle();
  if (moduleError?.code === "PGRST205") return true;
  return moduleAccess?.enabled === true;
}

export async function assertBusinessFeatureAccessAdmin(businessId: string, feature: CrmModule) {
  if (!await hasBusinessFeatureAccessAdmin(businessId, feature)) throw new BusinessAccessError("FEATURE_DISABLED");
}
