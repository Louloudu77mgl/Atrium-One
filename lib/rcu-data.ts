import { getMerchant } from "@/lib/merchants";
import { listStoredRcuCustomers, listStoredRcuForms } from "@/lib/rcu-store";
import type { RcuProgram } from "@/lib/rcu";
import type { CustomerRow, MerchantRow } from "@/lib/supabase/types";

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

  const [customers, forms] = await Promise.all([
    listStoredRcuCustomers(currentMerchant.id),
    listStoredRcuForms(currentMerchant.id)
  ]);

  return {
    customers,
    forms
  };
}
