import { getBrandSettings } from "@/lib/brand-settings";
import { listEmailCampaigns, listSuppressedEmailAddresses } from "@/lib/emailing-store";
import type { EmailSubscriberProfile, EmailingDashboardData } from "@/lib/emailing-types";
import { getGmailConnection, isGmailConnectionReady } from "@/lib/gmail-connections";
import type { Review } from "@/lib/mock-data";
import { getRcuCustomerKey, listStoredRcuGameRecords, listStoredRcuLeads, listStoredRcuRaffleDraws, listStoredRcuRewardRedemptions } from "@/lib/rcu-store";
import { hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MerchantRow } from "@/lib/supabase/types";

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]/g, "");
}

function isWinningWheelPrize(label: string | undefined) {
  const value = label?.toLocaleLowerCase("fr-FR") ?? "";
  return Boolean(value && !value.includes("rien") && !value.includes("retentez") && !value.includes("rejouez"));
}

function groupByCustomerKey<T extends { customer_key: string }>(records: T[]) {
  const grouped = new Map<string, T[]>();
  records.forEach((record) => {
    const current = grouped.get(record.customer_key);
    if (current) current.push(record);
    else grouped.set(record.customer_key, [record]);
  });
  return grouped;
}

export async function getEmailingDashboardData(
  merchant: MerchantRow | null,
  reviews: Review[],
  databaseClient?: SupabaseClient<Database>
): Promise<EmailingDashboardData & {
  brand: Awaited<ReturnType<typeof getBrandSettings>>;
}> {
  if (!merchant || !hasSupabaseAdminEnv()) {
    return { subscribers: [], campaigns: [], providerReady: false, providerAddress: null, providerStatus: "disconnected", providerError: null, brand: null };
  }

  let dashboardData;

  try {
    dashboardData = await Promise.all([
      listStoredRcuLeads(merchant.id),
      listStoredRcuGameRecords(merchant.id),
      listStoredRcuRewardRedemptions(merchant.id),
      listStoredRcuRaffleDraws(merchant.id),
      listEmailCampaigns(merchant.id),
      listSuppressedEmailAddresses(merchant.id),
      getBrandSettings(merchant, databaseClient),
      getGmailConnection(merchant, databaseClient)
    ]);
  } catch (error) {
    console.error("[emailing/dashboard] storage_unavailable", {
      merchantId: merchant.id,
      message: error instanceof Error ? error.message : "Erreur inconnue"
    });

    const [brandResult, gmailResult] = await Promise.allSettled([
      getBrandSettings(merchant, databaseClient),
      getGmailConnection(merchant, databaseClient)
    ]);
    const brand = brandResult.status === "fulfilled" ? brandResult.value : null;
    const gmailConnection = gmailResult.status === "fulfilled" ? gmailResult.value : null;

    return {
      subscribers: [],
      campaigns: [],
      providerReady: isGmailConnectionReady(gmailConnection),
      providerAddress: gmailConnection?.gmail_address ?? null,
      providerStatus: gmailConnection?.status ?? "disconnected",
      providerError: "Les données clients sont momentanément indisponibles.",
      brand
    };
  }

  const [leads, plays, redemptions, raffleDraws, campaigns, suppressedEmails, brand, gmailConnection] = dashboardData;
  const playsByCustomer = groupByCustomerKey(plays);
  const redemptionsByCustomer = groupByCustomerKey(redemptions);
  const drawsByCustomer = groupByCustomerKey(raffleDraws);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86_400_000;
  const ninetyDaysAgo = now - 90 * 86_400_000;
  const latestByCustomer = new Map<string, (typeof leads)[number]>();
  leads.forEach((lead) => {
    const key = getRcuCustomerKey(merchant.id, lead.phone, lead.email);
    if (!latestByCustomer.has(key)) latestByCustomer.set(key, lead);
  });
  const reviewByName = new Map<string, Review>();
  reviews.forEach((review) => {
    const key = normalizeName(review.author);
    const current = reviewByName.get(key);
    if (!current || (review.createdAt ?? "") > (current.createdAt ?? "")) reviewByName.set(key, review);
  });
  const profilesByCustomer = new Map<string, EmailSubscriberProfile>();

  latestByCustomer.forEach((lead) => {
    const email = lead.email?.trim().toLocaleLowerCase("fr-FR") ?? "";
    const customerKey = getRcuCustomerKey(merchant.id, lead.phone, lead.email);
    const hasEmailConsent = lead.consent_email === true;
    const emailValid = /^\S+@\S+\.\S+$/.test(email);
    const customerName = normalizeName(`${lead.first_name} ${lead.last_name}`);
    const directPlays = playsByCustomer.get(customerKey) ?? [];
    const legacyPlays = lead.customer_key && lead.customer_key !== customerKey
      ? (playsByCustomer.get(lead.customer_key) ?? []).filter((play) => normalizeName(`${play.first_name} ${play.last_name}`) === customerName)
      : [];
    const customerPlays = legacyPlays.length > 0 ? [...directPlays, ...legacyPlays] : directPlays;
    const customerRedemptions = redemptionsByCustomer.get(customerKey) ?? [];
    const customerDraws = drawsByCustomer.get(customerKey) ?? [];
    const review = reviewByName.get(normalizeName(`${lead.first_name}${lead.last_name}`))
      ?? reviewByName.get(normalizeName(`${lead.first_name} ${lead.last_name}`));
    const rewardsWon = customerPlays.reduce((total, play) => total
      + (play.result.unlockedRewards?.length ?? 0)
      + (play.result.rewardUnlocked ? 1 : 0)
      + (isWinningWheelPrize(play.result.wheelPrize) ? 1 : 0), 0) + customerDraws.length;
    const profile: EmailSubscriberProfile = {
      id: customerKey || lead.id,
      email,
      emailConsent: hasEmailConsent && !suppressedEmails.has(email),
      emailValid,
      firstName: lead.first_name,
      lastName: lead.last_name,
      source: lead.source ?? "rcu",
      registeredAt: lead.submitted_at,
      lastVisitAt: customerPlays[0]?.occurred_at ?? null,
      visits: customerPlays.length,
      rewardsWon,
      rewardsUsed: customerRedemptions.length,
      points: Math.max(0, customerPlays.reduce((sum, play) => sum + (play.result.pointsDelta ?? 0), 0) - customerRedemptions.reduce((sum, redemption) => sum + redemption.points_cost, 0)),
      reviewRating: review?.rating ?? null,
      birthday: lead.birthday ?? null,
      preferences: (lead.favorite_products ?? "").split(/[,;|]/).map((value) => value.trim()).filter(Boolean),
      visitsLast30Days: customerPlays.filter((play) => new Date(play.occurred_at).getTime() >= thirtyDaysAgo).length,
      visitsLast90Days: customerPlays.filter((play) => new Date(play.occurred_at).getTime() >= ninetyDaysAgo).length
    };
    const existing = profilesByCustomer.get(profile.id);
    if (!existing || profile.registeredAt > existing.registeredAt) profilesByCustomer.set(profile.id, profile);
  });

  return {
    subscribers: Array.from(profilesByCustomer.values()).sort((left, right) => right.registeredAt.localeCompare(left.registeredAt)),
    campaigns,
    providerReady: isGmailConnectionReady(gmailConnection),
    providerAddress: gmailConnection?.gmail_address ?? null,
    providerStatus: gmailConnection?.status ?? "disconnected",
    providerError: gmailConnection?.last_error ?? null,
    brand
  };
}
