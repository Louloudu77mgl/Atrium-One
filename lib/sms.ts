import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMerchant } from "@/lib/merchants";
import {
  buildSmsAudience,
  estimateSmsParts,
  generatePersonalizedSms,
  normalizeFrenchPhone,
  parseCustomerCsv,
  type CsvImportRow,
  type SmsTone
} from "@/lib/sms-shared";
import type {
  CustomerEventRow,
  CustomerRow,
  MerchantRow,
  RcuFormRow,
  SmsCampaignRow,
  SmsLeadFormRow,
  SmsMessageRow,
  SmsTemplateRow
} from "@/lib/supabase/types";

export {
  buildSmsAudience,
  estimateSmsParts,
  generatePersonalizedSms,
  normalizeFrenchPhone,
  parseCustomerCsv
};
export type { CsvImportRow, SmsTone };

export type SmsModuleData = {
  customers: CustomerRow[];
  customerEvents: CustomerEventRow[];
  campaigns: SmsCampaignRow[];
  messages: SmsMessageRow[];
  templates: SmsTemplateRow[];
  forms: RcuFormRow[];
  leads: SmsLeadFormRow[];
};

function hasMissingSmsTables(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("could not find the table") || message.includes("schema cache");
}

export async function getSmsModuleData(merchant?: MerchantRow | null): Promise<SmsModuleData> {
  const currentMerchant = merchant ?? (await getMerchant());

  if (!currentMerchant) {
    return getDemoSmsModuleData();
  }

  const supabase = await createServerSupabaseClient();
  const merchantId = currentMerchant.id;

  const [customersResponse, eventsResponse, campaignsResponse, messagesResponse, templatesResponse, formsResponse, leadsResponse] = await Promise.all([
    supabase.from("customers").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
    supabase.from("customer_events").select("*").eq("merchant_id", merchantId).order("happened_at", { ascending: false }),
    supabase.from("sms_campaigns").select("*").eq("merchant_id", merchantId).order("updated_at", { ascending: false }),
    supabase.from("sms_messages").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(100),
    supabase.from("sms_templates").select("*").or(`merchant_id.eq.${merchantId},merchant_id.is.null`).order("created_at", { ascending: false }),
    supabase.from("rcu_forms").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
    supabase.from("sms_leads_forms").select("*").eq("merchant_id", merchantId).order("submitted_at", { ascending: false }).limit(100)
  ]);

  if (
    hasMissingSmsTables(customersResponse.error) ||
    hasMissingSmsTables(eventsResponse.error) ||
    hasMissingSmsTables(campaignsResponse.error) ||
    hasMissingSmsTables(messagesResponse.error) ||
    hasMissingSmsTables(templatesResponse.error) ||
    hasMissingSmsTables(formsResponse.error) ||
    hasMissingSmsTables(leadsResponse.error)
  ) {
    return getDemoSmsModuleData(currentMerchant.business_type);
  }

  const firstError = [
    customersResponse.error,
    eventsResponse.error,
    campaignsResponse.error,
    messagesResponse.error,
    templatesResponse.error,
    formsResponse.error,
    leadsResponse.error
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    customers: customersResponse.data ?? [],
    customerEvents: eventsResponse.data ?? [],
    campaigns: campaignsResponse.data ?? [],
    messages: messagesResponse.data ?? [],
    templates: templatesResponse.data ?? [],
    forms: formsResponse.data ?? [],
    leads: leadsResponse.data ?? []
  };
}

export function getDemoSmsModuleData(businessType = "commerce local"): SmsModuleData {
  return {
    customers: [],
    customerEvents: [],
    campaigns: [],
    messages: [],
    templates: [
      {
        id: "demo-template-1",
        merchant_id: null,
        name: "Relance douce",
        objective: "Faire revenir un client",
        tone: "chaleureux",
        template_text: "Bonjour {{first_name}} ! Cela fait un moment, Hans vous propose une relance simple et personnalisée.",
        created_at: new Date().toISOString()
      }
    ],
    forms: [],
    leads: []
  };
}
