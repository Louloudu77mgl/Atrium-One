import { getMerchant } from "@/lib/merchants";
import { LEGACY_RCU_TYPE_MAP, isRcuFormType, normalizeRcuGameConfig, type RcuGameConfig, type RcuProgram } from "@/lib/rcu";
import { listStoredRcuCustomers, listStoredRcuForms } from "@/lib/rcu-store";
import { getSmsModuleData } from "@/lib/sms";
import { hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import type { CustomerRow, Json, MerchantRow, RcuFormRow } from "@/lib/supabase/types";

export type RcuDashboardData = {
  customers: CustomerRow[];
  forms: RcuProgram[];
};

export async function getRcuDashboardData(merchant?: MerchantRow | null): Promise<RcuDashboardData> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return {
      customers: [],
      forms: []
    };
  }

  if (!hasSupabaseAdminEnv()) {
    return getDatabaseFallback(currentMerchant);
  }

  try {
    const [customers, forms] = await Promise.all([
      listStoredRcuCustomers(currentMerchant.id),
      listStoredRcuForms(currentMerchant.id)
    ]);

    return {
      customers,
      forms
    };
  } catch (error) {
    console.error("[rcu/dashboard] storage_unavailable", {
      merchantId: currentMerchant.id,
      message: error instanceof Error ? error.message : "Erreur inconnue"
    });

    return getDatabaseFallback(currentMerchant);
  }
}

async function getDatabaseFallback(merchant: MerchantRow): Promise<RcuDashboardData> {
  try {
    const data = await getSmsModuleData(merchant);

    return {
      customers: data.customers,
      forms: data.forms.map(normalizeDatabaseForm).filter((form): form is RcuProgram => Boolean(form))
    };
  } catch (error) {
    console.error("[rcu/dashboard] database_fallback_failed", {
      merchantId: merchant.id,
      message: error instanceof Error ? error.message : "Erreur inconnue"
    });

    return { customers: [], forms: [] };
  }
}

function normalizeDatabaseForm(form: RcuFormRow): RcuProgram | null {
  const formType = isRcuFormType(form.form_type) ? form.form_type : LEGACY_RCU_TYPE_MAP[form.form_type];
  if (!formType) return null;

  return {
    ...form,
    form_type: formType,
    game_config: normalizeRcuGameConfig(formType, toGameConfig(form.game_config))
  };
}

function toGameConfig(value: Json): RcuGameConfig {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RcuGameConfig
    : {};
}
