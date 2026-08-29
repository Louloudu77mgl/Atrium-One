import { runAutomationEvent } from "@/lib/automation-event-runner";
import { listStoredAutomationFlows } from "@/lib/automation-execution-store";
import { getRcuCustomerKey, listStoredRcuGameRecords, listStoredRcuLeads } from "@/lib/rcu-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const scheduledCustomerTriggers = new Set(["customer_inactive", "customer_birthday", "registration_anniversary"]);

export async function runScheduledCustomerAutomations(limit = 100) {
  const supabase = createSupabaseAdminClient();
  const { data: merchants, error } = await supabase.from("merchants").select("id");
  if (error) throw new Error(error.message);
  const results: Array<{ merchantId: string; customerId?: string; type?: string; status: string; error?: string }> = [];

  for (const merchant of merchants ?? []) {
    if (results.length >= limit) break;
    try {
      const flows = await listStoredAutomationFlows(merchant.id);
      if (!flows.some((flow) => flow.status === "active" && flow.nodes.some((node) => scheduledCustomerTriggers.has(node.type)))) continue;
      const [leads, records] = await Promise.all([listStoredRcuLeads(merchant.id), listStoredRcuGameRecords(merchant.id)]);
      const latestByCustomer = new Map<string, (typeof leads)[number]>();
      leads.slice().sort((left, right) => right.submitted_at.localeCompare(left.submitted_at)).forEach((lead) => {
        const customerKey = getRcuCustomerKey(merchant.id, lead.phone, lead.email);
        if (!latestByCustomer.has(customerKey)) latestByCustomer.set(customerKey, lead);
      });

      for (const [customerKey, lead] of latestByCustomer) {
        if (results.length >= limit) break;
        const customerRecords = records.filter((record) => record.customer_key === customerKey).sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
        const latestVisit = customerRecords[0] ?? null;
        const today = getParisDay();
        const inactivityDays = latestVisit ? dayDistance(latestVisit.visit_day, today) : dayDistance(lead.submitted_at.slice(0, 10), today);
        const points = Math.max(0, customerRecords.reduce((total, record) => total + (record.result.pointsDelta ?? 0), 0));
        const rewards = customerRecords.reduce((total, record) => total + (record.result.unlockedRewards?.length ?? 0) + (record.result.rewardUnlocked ? 1 : 0), 0);
        const baseEvent = {
          merchantId: merchant.id,
          occurredAt: new Date().toISOString(),
          customer: {
            id: customerKey,
            firstName: lead.first_name,
            lastName: lead.last_name,
            email: lead.email,
            phone: lead.phone,
            consentEmail: lead.consent_email === true,
            consentSms: lead.consent_sms === true,
            source: "RCU" as const,
            rewards
          },
          details: { visits: customerRecords.length, points, birthday: lead.birthday ?? null, registeredAt: lead.submitted_at, inactivityDays, latestVisitAt: latestVisit?.occurred_at ?? null }
        };
        const events = [];
        if (inactivityDays >= 1) events.push({ ...baseEvent, id: `${customerKey}:inactive:${latestVisit?.visit_day ?? lead.submitted_at.slice(0, 10)}`, type: "customer_inactive" as const });
        if (lead.birthday && lead.birthday.slice(5) === today.slice(5)) events.push({ ...baseEvent, id: `${customerKey}:birthday:${today.slice(0, 4)}`, type: "customer_birthday" as const });
        const registrationYears = Number(today.slice(0, 4)) - Number(lead.submitted_at.slice(0, 4));
        if (registrationYears >= 1 && lead.submitted_at.slice(5, 10) === today.slice(5)) events.push({ ...baseEvent, id: `${customerKey}:registration-anniversary:${today.slice(0, 4)}`, type: "registration_anniversary" as const });

        for (const event of events) {
          await runAutomationEvent(event);
          results.push({ merchantId: merchant.id, customerId: customerKey, type: event.type, status: "processed" });
        }
      }
    } catch (caught) {
      results.push({ merchantId: merchant.id, status: "error", error: caught instanceof Error ? caught.message : "Erreur inconnue" });
    }
  }
  return results;
}

function getParisDay() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayDistance(from: string, to: string) {
  return Math.max(0, Math.floor((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000));
}
