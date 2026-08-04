import { randomBytes, randomInt, randomUUID } from "crypto";
import type { RcuGameResult, RcuProgram, RcuReward } from "@/lib/rcu";
import {
  getRcuCustomerKey,
  getStoredRcuGameRecordForDay,
  listStoredRcuGameRecords,
  listStoredRcuRewardRedemptions,
  saveStoredRcuGameRecord,
  type RcuGameRecord
} from "@/lib/rcu-store";

function parisDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: value("weekday")
  };
}

export function getRcuVisitDay(date = new Date()) {
  return parisDateParts(date).day;
}

function dayDistance(previousDay: string, currentDay: string) {
  return Math.round((Date.parse(`${currentDay}T12:00:00Z`) - Date.parse(`${previousDay}T12:00:00Z`)) / 86_400_000);
}

function pickWeightedPrize(prizes: Array<{ label: string; weight: number }>) {
  const validPrizes = prizes
    .map((prize, index) => ({ ...prize, index }))
    .filter((prize) => prize.label.trim() && Number.isFinite(prize.weight) && prize.weight > 0);
  if (validPrizes.length === 0) return { label: "Retentez votre chance", index: 0 };
  const totalWeight = validPrizes.reduce((sum, prize) => sum + Math.round(prize.weight * 100), 0);
  const draw = randomInt(totalWeight);
  let cursor = 0;
  for (const prize of validPrizes) {
    cursor += Math.round(prize.weight * 100);
    if (draw < cursor) return { label: prize.label, index: prize.index };
  }
  const fallback = validPrizes.at(-1);
  return { label: fallback?.label ?? "Retentez votre chance", index: fallback?.index ?? 0 };
}

function cleanRewards(rewards: RcuReward[] | undefined) {
  return (rewards ?? [])
    .filter((reward) => Number.isFinite(reward.points) && reward.points > 0 && reward.label.trim())
    .sort((left, right) => left.points - right.points);
}

function buildPointsResult(form: RcuProgram, previous: RcuGameRecord[], allPrevious: RcuGameRecord[], pointsSpent: number, reviewConfirmed: boolean): RcuGameResult {
  const config = form.game_config;
  const basePoints = Math.max(0, Math.round(config.visitPoints ?? 10));
  const uniqueDaysBefore = new Set(previous.map((record) => record.visit_day)).size;
  const fiveDayBonus = (uniqueDaysBefore + 1) % 5 === 0 ? Math.max(0, Math.round(config.fiveDayBonus ?? 50)) : 0;
  const reviewAlreadyRewarded = previous.some((record) => record.result.reviewBonusApplied);
  const reviewBonusApplied = reviewConfirmed && !reviewAlreadyRewarded;
  const reviewBonus = reviewBonusApplied ? Math.max(0, Math.round(config.reviewBonus ?? 100)) : 0;
  const pointsBefore = Math.max(0, allPrevious.reduce((sum, record) => sum + (record.result.pointsDelta ?? 0), 0) - pointsSpent);
  const pointsDelta = basePoints + fiveDayBonus + reviewBonus;
  const pointsTotal = pointsBefore + pointsDelta;
  const rewards = cleanRewards(config.rewards);
  const unlockedRewards = rewards.filter((reward) => reward.points > pointsBefore && reward.points <= pointsTotal);
  const nextReward = rewards.find((reward) => reward.points > pointsTotal) ?? null;
  const bonuses = [
    fiveDayBonus ? `+${fiveDayBonus} bonus 5 jours` : null,
    reviewBonus ? `+${reviewBonus} avis` : null
  ].filter(Boolean);

  return {
    programType: "points",
    message: `+${pointsDelta} points aujourd’hui${bonuses.length ? ` (${bonuses.join(", ")})` : ""}.`,
    pointsDelta,
    pointsTotal,
    uniqueVisitDays: uniqueDaysBefore + 1,
    reviewBonusApplied,
    unlockedRewards,
    nextReward
  };
}

function buildWheelResult(form: RcuProgram): RcuGameResult {
  const prize = pickWeightedPrize(form.game_config.wheelPrizes ?? []);
  const wheelPrize = prize.label;
  return {
    programType: "wheel",
    message: wheelPrize.toLowerCase().includes("retentez") || wheelPrize.toLowerCase().includes("rien")
      ? "Pas de gain cette fois, mais une nouvelle chance vous attend à votre prochaine visite."
      : `Bravo, vous gagnez : ${wheelPrize}.`,
    wheelPrize,
    wheelPrizeIndex: prize.index
  };
}

function buildRaffleResult(form: RcuProgram, previous: RcuGameRecord[], visitDay: string): RcuGameResult {
  const raffleMonth = visitDay.slice(0, 7);
  const raffleTicketsTotal = previous.filter((record) => record.result.raffleMonth === raffleMonth).length + 1;
  const raffleTicket = `${form.slug.slice(0, 4).toUpperCase()}-${raffleMonth.replace("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  return {
    programType: "raffle",
    message: `Votre ticket pour gagner ${form.game_config.rafflePrize ?? "le lot du mois"} est validé.`,
    raffleTicket,
    raffleMonth,
    raffleTicketsTotal
  };
}

function buildStampResult(form: RcuProgram, previous: RcuGameRecord[]): RcuGameResult {
  const stampTarget = Math.max(2, Math.round(form.game_config.stampTarget ?? 5));
  const totalVisits = previous.length + 1;
  const stampCount = totalVisits % stampTarget === 0 ? stampTarget : totalVisits % stampTarget;
  const stampCycle = Math.ceil(totalVisits / stampTarget);
  const rewardUnlocked = stampCount === stampTarget;
  const stampReward = form.game_config.stampReward ?? "Votre cadeau fidélité";
  return {
    programType: "stamps",
    message: rewardUnlocked
      ? `Carte complète : ${stampReward} est débloqué.`
      : `Visite ${stampCount} sur ${stampTarget} validée.`,
    stampCount,
    stampTarget,
    stampCycle,
    stampReward,
    rewardUnlocked
  };
}

function buildHansResult(form: RcuProgram, previous: RcuGameRecord[], allPrevious: RcuGameRecord[], pointsSpent: number, visitDay: string, weekday: string): RcuGameResult {
  const config = form.game_config;
  const basePoints = Math.max(0, Math.round(config.visitPoints ?? 10));
  const inactivityDays = Math.max(1, Math.round(config.inactivityDays ?? 25));
  const inactivityMultiplier = Math.max(1, config.inactivityMultiplier ?? 2);
  const lastVisit = previous[0]?.visit_day;
  const gap = lastVisit ? dayDistance(lastVisit, visitDay) : 0;
  const hansMultiplier = gap >= inactivityDays ? inactivityMultiplier : 1;
  const pointsDelta = Math.round(basePoints * hansMultiplier);
  const pointsTotal = Math.max(0, allPrevious.reduce((sum, record) => sum + (record.result.pointsDelta ?? 0), 0) - pointsSpent) + pointsDelta;
  const sameWeekdayVisits = previous.filter((record) => parisDateParts(new Date(`${record.visit_day}T12:00:00Z`)).weekday === weekday).length;
  const chronologicalDays = [...new Set(previous.map((record) => record.visit_day))].sort();
  const gaps = chronologicalDays.slice(1).map((day, index) => dayDistance(chronologicalDays[index], day)).filter((value) => value > 0);
  const averageGap = gaps.length ? Math.round(gaps.reduce((sum, value) => sum + value, 0) / gaps.length) : null;
  let hansPattern: RcuGameResult["hansPattern"] = "welcome";
  let hansRecommendation = "Bienvenue : Hans commence à apprendre votre rythme dès aujourd’hui.";
  let hansOfferExpiresAt: string | undefined;
  if (hansMultiplier > 1) {
    hansPattern = "inactive";
    hansRecommendation = `Retour après ${gap} jours : Hans active un bonus ×${hansMultiplier} aujourd’hui.`;
    hansOfferExpiresAt = visitDay;
  } else if (sameWeekdayVisits >= 2) {
    hansPattern = "habit";
    hansRecommendation = `Habitude détectée le ${weekday} : une attention personnalisée est recommandée lors de votre prochain passage ce jour-là.`;
  } else if (averageGap !== null && averageGap <= 10) {
    hansPattern = "regular";
    hansRecommendation = `Vous revenez environ tous les ${averageGap} jours : Hans suit cette régularité et prépare votre prochaine récompense.`;
  }

  return {
    programType: "smart_hans",
    message: `${pointsDelta} points intelligents ajoutés.`,
    pointsDelta,
    pointsTotal,
    hansMultiplier,
    hansPattern,
    hansOfferExpiresAt,
    hansRecommendation
  };
}

export async function playRcuGame({
  form,
  phone,
  firstName,
  lastName,
  reviewConfirmed = false,
  now = new Date()
}: {
  form: RcuProgram;
  phone: string;
  firstName: string;
  lastName: string;
  reviewConfirmed?: boolean;
  now?: Date;
}) {
  const { day: visitDay, weekday } = parisDateParts(now);
  const customerKey = getRcuCustomerKey(form.merchant_id, phone);
  const existing = await getStoredRcuGameRecordForDay({
    merchantId: form.merchant_id,
    programId: form.id,
    customerKey,
    visitDay
  });
  if (existing) return { record: existing, duplicate: true };

  const [allPrevious, redemptions] = await Promise.all([
    listStoredRcuGameRecords(form.merchant_id, { customerKey }),
    listStoredRcuRewardRedemptions(form.merchant_id, { customerKey })
  ]);
  const previous = allPrevious.filter((record) => record.program_id === form.id);
  const pointsSpent = redemptions.reduce((sum, redemption) => sum + redemption.points_cost, 0);
  let result: RcuGameResult;
  if (form.form_type === "points") result = buildPointsResult(form, previous, allPrevious, pointsSpent, reviewConfirmed);
  else if (form.form_type === "wheel") result = buildWheelResult(form);
  else if (form.form_type === "raffle") result = buildRaffleResult(form, previous, visitDay);
  else if (form.form_type === "stamps") result = buildStampResult(form, previous);
  else result = buildHansResult(form, previous, allPrevious, pointsSpent, visitDay, weekday);

  const record: RcuGameRecord = {
    id: randomUUID(),
    public_token: randomBytes(16).toString("hex"),
    record_type: "game_play",
    merchant_id: form.merchant_id,
    program_id: form.id,
    program_slug: form.slug,
    program_title: form.title,
    program_type: form.form_type,
    customer_key: customerKey,
    phone,
    first_name: firstName,
    last_name: lastName,
    visit_day: visitDay,
    occurred_at: now.toISOString(),
    result
  };
  const persisted = await saveStoredRcuGameRecord(record);
  return { record: persisted, duplicate: persisted.id !== record.id };
}
