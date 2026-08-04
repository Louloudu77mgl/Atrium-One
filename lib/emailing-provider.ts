import { getEmailCampaign, saveEmailCampaign } from "@/lib/emailing-store";
import { personalizeEmailText, renderEmailHtml } from "@/lib/emailing-template";
import type { EmailCampaignRecord } from "@/lib/emailing-types";
import type { MerchantRow } from "@/lib/supabase/types";

type ResendBatchResponse = { data?: Array<{ id?: string }> | { id?: string }[]; error?: { message?: string }; message?: string } | Array<{ id?: string }>;

export function getEmailProviderStatus() {
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || "";
  return { ready: Boolean(process.env.RESEND_API_KEY && from), provider: "Resend", from };
}

export async function dispatchEmailCampaign({
  campaign,
  merchant,
  origin
}: {
  campaign: EmailCampaignRecord;
  merchant: MerchantRow;
  origin: string;
}) {
  const provider = getEmailProviderStatus();
  if (!provider.ready) throw new Error("Connectez un expéditeur e-mail avec RESEND_API_KEY et EMAIL_FROM avant l’envoi.");
  if (campaign.recipients.length === 0) throw new Error("Aucun abonné ne correspond à ce segment.");
  if (campaign.status === "sent") return campaign;

  let current = await saveEmailCampaign({ ...campaign, status: "sending", error_message: null, updated_at: new Date().toISOString() });
  const providerIds = [...current.provider_message_ids];
  let sentCount = current.sent_count;

  try {
    for (let index = sentCount; index < current.recipients.length; index += 100) {
      const recipients = current.recipients.slice(index, index + 100);
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${current.id}-${index}`
        },
        body: JSON.stringify(recipients.map((recipient) => ({
          from: provider.from,
          to: [recipient.email],
          subject: personalizeEmailText(current.content.subject, recipient),
          html: renderEmailHtml({ campaign: current, merchant, recipient, origin }),
          tags: [{ name: "campaign_id", value: current.id }]
        })))
      });
      const payload = await response.json() as ResendBatchResponse;
      if (!response.ok) {
        const message = !Array.isArray(payload) ? payload.error?.message || payload.message : null;
        throw new Error(message || `Envoi refusé par Resend (${response.status}).`);
      }
      const resultRows = Array.isArray(payload) ? payload : payload.data ?? [];
      providerIds.push(...resultRows.map((row) => row.id).filter((id): id is string => Boolean(id)));
      sentCount += recipients.length;
      current = await saveEmailCampaign({ ...current, sent_count: sentCount, provider_message_ids: providerIds, updated_at: new Date().toISOString() });
    }

    return saveEmailCampaign({ ...current, status: "sent", sent_at: new Date().toISOString(), scheduled_at: null, error_message: null, updated_at: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Envoi impossible.";
    await saveEmailCampaign({ ...current, status: "failed", sent_count: sentCount, provider_message_ids: providerIds, error_message: message, updated_at: new Date().toISOString() });
    throw new Error(message);
  }
}

export async function claimEmailCampaign(campaignId: string) {
  const campaign = await getEmailCampaign(campaignId);
  if (!campaign || campaign.status !== "scheduled" || !campaign.scheduled_at || new Date(campaign.scheduled_at) > new Date()) return null;
  return saveEmailCampaign({ ...campaign, status: "sending", updated_at: new Date().toISOString() });
}
