import { randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runAutomationEvent } from "@/lib/automation-event-runner";
import { getMerchant } from "@/lib/merchants";
import { buildRcuLoyaltySnapshot } from "@/lib/rcu-loyalty";
import { getRcuVisitDay } from "@/lib/rcu-game-server";
import {
  listStoredRcuForms,
  listStoredRcuGameRecords,
  listStoredRcuRaffleDraws,
  listStoredRcuRewardRedemptions,
  listStoredRcuLeads,
  getStoredRcuWalletForCustomer,
  saveStoredRcuRewardRedemption
} from "@/lib/rcu-store";

export async function redeemRcuReward({ merchantId, customerKey, rewardId }: { merchantId: string; customerKey: string; rewardId: string }) {
  const [programs, plays, redemptions, raffleDraws] = await Promise.all([
    listStoredRcuForms(merchantId),
    listStoredRcuGameRecords(merchantId, { customerKey }),
    listStoredRcuRewardRedemptions(merchantId, { customerKey }),
    listStoredRcuRaffleDraws(merchantId, { customerKey })
  ]);
  const snapshot = buildRcuLoyaltySnapshot({ programs, plays, redemptions, raffleDraws });
  const reward = snapshot.availableRewards.find((item) => item.id === rewardId);
  if (!reward) throw new Error("Cette récompense n’est plus disponible.");
  const occurredAt = new Date().toISOString();
  const persisted = await saveStoredRcuRewardRedemption({
    id: randomUUID(),
    public_token: randomBytes(16).toString("hex"),
    record_type: "reward_redemption",
    merchant_id: merchantId,
    program_id: reward.programId,
    program_title: reward.programTitle,
    customer_key: customerKey,
    reward_id: reward.id,
    reward_label: reward.label,
    points_cost: reward.pointsCost,
    visit_day: getRcuVisitDay(),
    occurred_at: occurredAt
  });
  const wallet = await getStoredRcuWalletForCustomer(merchantId, customerKey);
  const leads = await listStoredRcuLeads(merchantId);
  const lead = leads.find((item) => item.customer_key === customerKey) ?? null;
  if (wallet) {
    after(async () => {
      try {
        await runAutomationEvent({
          merchantId,
          id: `${persisted.id}:reward_used`,
          type: "reward_used",
          occurredAt,
          customer: {
            id: customerKey,
            firstName: wallet.first_name,
            lastName: wallet.last_name,
            email: wallet.email,
            phone: wallet.phone,
            consentEmail: lead?.consent_email === true,
            consentSms: lead?.consent_sms === true,
            source: "RCU",
            rewards: snapshot.availableRewards.length
          },
          details: { reward: reward.label, pointsCost: reward.pointsCost, points: snapshot.pointsBalance - reward.pointsCost }
        });
      } catch (error) {
        console.error("[rcu/automation] reward_used_failed", { merchantId, customerKey, message: error instanceof Error ? error.message : "Erreur inconnue" });
      }
    });
  }
  return persisted;
}

export async function redeemRcuRewardAction(formData: FormData) {
  "use server";
  const merchant = await getMerchant();
  if (!merchant) throw new Error("Commerce introuvable.");
  const customerKey = String(formData.get("customer_key") ?? "");
  const rewardId = String(formData.get("reward_id") ?? "");
  if (!/^[a-f0-9]{24}$/i.test(customerKey) || !rewardId) throw new Error("Récompense invalide.");
  await redeemRcuReward({ merchantId: merchant.id, customerKey, rewardId });
  const wallet = await getStoredRcuWalletForCustomer(merchant.id, customerKey);
  revalidatePath(`/fidelisation/clients/${customerKey}`);
  if (wallet) revalidatePath(`/fidelite/${wallet.token}`);
}
