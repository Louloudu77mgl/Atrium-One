import { getBrandSettings } from "@/lib/brand-settings";
import { listEmailCampaigns, listSuppressedEmailAddresses } from "@/lib/emailing-store";
import type { EmailSubscriberProfile, EmailingDashboardData } from "@/lib/emailing-types";
import { getGmailConnection, isGmailConnectionReady } from "@/lib/gmail-connections";
import type { Review } from "@/lib/mock-data";
import { listStoredRcuGameRecords, listStoredRcuLeads, listStoredRcuRaffleDraws, listStoredRcuRewardRedemptions } from "@/lib/rcu-store";
import { hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import type { MerchantRow } from "@/lib/supabase/types";

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]/g, "");
}

function isWinningWheelPrize(label: string | undefined) {
  const value = label?.toLocaleLowerCase("fr-FR") ?? "";
  return Boolean(value && !value.includes("rien") && !value.includes("retentez") && !value.includes("rejouez"));
}

export async function getEmailingDashboardData(merchant: MerchantRow | null, reviews: Review[]): Promise<EmailingDashboardData & {
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
      getBrandSettings(merchant),
      getGmailConnection(merchant)
    ]);
  } catch (error) {
    console.error("[emailing/dashboard] storage_unavailable", {
      merchantId: merchant.id,
      message: error instanceof Error ? error.message : "Erreur inconnue"
    });

    const [brandResult, gmailResult] = await Promise.allSettled([
      getBrandSettings(merchant),
      getGmailConnection(merchant)
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
  const latestByCustomer = new Map<string, (typeof leads)[number]>();
  leads.forEach((lead) => {
    const key = lead.customer_key ?? lead.phone;
    if (!latestByCustomer.has(key)) latestByCustomer.set(key, lead);
  });
  const reviewByName = new Map<string, Review>();
  reviews.forEach((review) => {
    const key = normalizeName(review.author);
    const current = reviewByName.get(key);
    if (!current || (review.createdAt ?? "") > (current.createdAt ?? "")) reviewByName.set(key, review);
  });
  const profilesByEmail = new Map<string, EmailSubscriberProfile>();

  latestByCustomer.forEach((lead) => {
    const email = lead.email?.trim().toLocaleLowerCase("fr-FR") ?? "";
    if (!lead.consent_email || suppressedEmails.has(email) || !/^\S+@\S+\.\S+$/.test(email)) return;
    const customerKey = lead.customer_key ?? "";
    const customerPlays = plays.filter((play) => play.customer_key === customerKey);
    const customerRedemptions = redemptions.filter((redemption) => redemption.customer_key === customerKey);
    const customerDraws = raffleDraws.filter((draw) => draw.customer_key === customerKey);
    const review = reviewByName.get(normalizeName(`${lead.first_name}${lead.last_name}`))
      ?? reviewByName.get(normalizeName(`${lead.first_name} ${lead.last_name}`));
    const rewardsWon = customerPlays.reduce((total, play) => total
      + (play.result.unlockedRewards?.length ?? 0)
      + (play.result.rewardUnlocked ? 1 : 0)
      + (isWinningWheelPrize(play.result.wheelPrize) ? 1 : 0), 0) + customerDraws.length;
    const profile: EmailSubscriberProfile = {
      id: customerKey || lead.id,
      email,
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
      birthday: lead.birthday ?? null
    };
    const existing = profilesByEmail.get(email);
    if (!existing || profile.registeredAt > existing.registeredAt) profilesByEmail.set(email, profile);
  });

  return {
    subscribers: Array.from(profilesByEmail.values()).sort((left, right) => right.registeredAt.localeCompare(left.registeredAt)),
    campaigns,
    providerReady: isGmailConnectionReady(gmailConnection),
    providerAddress: gmailConnection?.gmail_address ?? null,
    providerStatus: gmailConnection?.status ?? "disconnected",
    providerError: gmailConnection?.last_error ?? null,
    brand
  };
}
