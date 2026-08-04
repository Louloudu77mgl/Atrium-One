import type { RcuProgram, RcuReward } from "@/lib/rcu";
import type { RcuGameRecord, RcuRaffleDrawRecord, RcuRewardRedemptionRecord } from "@/lib/rcu-store";

export type RcuAvailableReward = {
  id: string;
  label: string;
  pointsCost: number;
  programId: string;
  programTitle: string;
  kind: "points" | "stamp" | "wheel" | "raffle";
};

export type RcuLoyaltySnapshot = {
  pointsEarned: number;
  pointsSpent: number;
  pointsBalance: number;
  totalVisits: number;
  availableRewards: RcuAvailableReward[];
  nextReward: (RcuReward & { programTitle: string }) | null;
  progressPercent: number;
  pointsHistory: Array<{ id: string; occurredAt: string; points: number; reason: string }>;
  usedRewards: RcuRewardRedemptionRecord[];
  raffleTickets: Array<{ id: string; month: string; ticket: string; programTitle: string; occurredAt: string }>;
  hansOffers: string[];
  temporaryBonus: string | null;
};

function isWinningWheelPrize(label: string | undefined) {
  const value = label?.toLowerCase() ?? "";
  return Boolean(value && !value.includes("rien") && !value.includes("retentez") && !value.includes("rejouez"));
}

function getParisDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dayDistance(previousDay: string, currentDay: string) {
  return Math.round((Date.parse(`${currentDay}T12:00:00Z`) - Date.parse(`${previousDay}T12:00:00Z`)) / 86_400_000);
}

export function buildRcuLoyaltySnapshot({ plays, redemptions, programs, raffleDraws = [] }: { plays: RcuGameRecord[]; redemptions: RcuRewardRedemptionRecord[]; programs: RcuProgram[]; raffleDraws?: RcuRaffleDrawRecord[] }): RcuLoyaltySnapshot {
  const pointsEarned = plays.reduce((sum, play) => sum + (play.result.pointsDelta ?? 0), 0);
  const pointsSpent = redemptions.reduce((sum, redemption) => sum + redemption.points_cost, 0);
  const pointsBalance = Math.max(0, pointsEarned - pointsSpent);
  const usedRewardIds = new Set(redemptions.map((redemption) => redemption.reward_id));
  const availableRewards: RcuAvailableReward[] = [];

  programs.filter((program) => program.form_type === "points").forEach((program) => {
    (program.game_config.rewards ?? []).filter((reward) => reward.points <= pointsBalance).forEach((reward) => {
      availableRewards.push({
        id: `${program.id}:points:${reward.points}`,
        label: reward.label,
        pointsCost: reward.points,
        programId: program.id,
        programTitle: program.title,
        kind: "points"
      });
    });
  });

  plays.forEach((play) => {
    if (play.result.rewardUnlocked && play.result.stampReward) {
      const id = `${play.program_id}:stamp:${play.id}`;
      if (!usedRewardIds.has(id)) availableRewards.push({ id, label: play.result.stampReward, pointsCost: 0, programId: play.program_id, programTitle: play.program_title, kind: "stamp" });
    }
    if (isWinningWheelPrize(play.result.wheelPrize)) {
      const id = `${play.program_id}:wheel:${play.id}`;
      if (!usedRewardIds.has(id)) availableRewards.push({ id, label: play.result.wheelPrize!, pointsCost: 0, programId: play.program_id, programTitle: play.program_title, kind: "wheel" });
    }
  });

  raffleDraws.forEach((draw) => {
    const id = `${draw.program_id}:raffle:${draw.id}`;
    if (!usedRewardIds.has(id)) availableRewards.push({ id, label: draw.prize_label, pointsCost: 0, programId: draw.program_id, programTitle: draw.program_title, kind: "raffle" });
  });

  const futureRewards = programs
    .filter((program) => program.form_type === "points")
    .flatMap((program) => (program.game_config.rewards ?? []).map((reward) => ({ ...reward, programTitle: program.title })))
    .filter((reward) => reward.points > pointsBalance)
    .sort((left, right) => left.points - right.points);
  const nextReward = futureRewards[0] ?? null;
  const previousThreshold = programs
    .flatMap((program) => program.game_config.rewards ?? [])
    .filter((reward) => reward.points <= pointsBalance)
    .reduce((max, reward) => Math.max(max, reward.points), 0);
  const progressPercent = nextReward
    ? Math.max(0, Math.min(100, Math.round(((pointsBalance - previousThreshold) / Math.max(1, nextReward.points - previousThreshold)) * 100)))
    : 100;
  const today = getParisDay();
  const hansOffers = Array.from(new Set(plays
    .filter((play) => play.result.hansPattern !== "inactive" || play.result.hansOfferExpiresAt === today)
    .map((play) => play.result.hansRecommendation)
    .filter((offer): offer is string => Boolean(offer)))).slice(0, 3);
  const latestVisit = plays[0]?.visit_day;
  const smartProgram = programs.find((program) => program.form_type === "smart_hans");
  const inactiveDays = latestVisit ? dayDistance(latestVisit, getParisDay()) : 0;
  const inactivityThreshold = smartProgram?.game_config.inactivityDays ?? 25;
  const multiplier = smartProgram?.game_config.inactivityMultiplier ?? 2;
  const activeHansBonus = plays.find((play) => play.visit_day === getParisDay() && (play.result.hansMultiplier ?? 1) > 1);
  const temporaryBonus = activeHansBonus
    ? `Bonus ×${activeHansBonus.result.hansMultiplier} activé aujourd’hui.`
    : smartProgram && inactiveDays >= inactivityThreshold
      ? `Revenez aujourd’hui : Hans activera un bonus ×${multiplier}.`
      : null;

  return {
    pointsEarned,
    pointsSpent,
    pointsBalance,
    totalVisits: plays.length,
    availableRewards,
    nextReward,
    progressPercent,
    pointsHistory: plays.filter((play) => (play.result.pointsDelta ?? 0) !== 0).map((play) => ({ id: play.id, occurredAt: play.occurred_at, points: play.result.pointsDelta ?? 0, reason: play.result.message })),
    usedRewards: redemptions,
    raffleTickets: plays.filter((play) => Boolean(play.result.raffleTicket)).map((play) => ({ id: play.id, month: play.result.raffleMonth!, ticket: play.result.raffleTicket!, programTitle: play.program_title, occurredAt: play.occurred_at })),
    hansOffers,
    temporaryBonus
  };
}
