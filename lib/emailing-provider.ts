import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailCampaign, saveEmailCampaign } from "@/lib/emailing-store";
import { personalizeEmailText, renderEmailHtml } from "@/lib/emailing-template";
import { getGmailConnection, isGmailConnectionReady, upsertGmailConnection } from "@/lib/gmail-connections";
import { sendGmailMessage } from "@/lib/gmail-messages";
import { getFreshGmailAccessToken } from "@/lib/gmail-tokens";
import type { EmailCampaignRecord } from "@/lib/emailing-types";
import type { Database, GmailConnectionRow, MerchantRow } from "@/lib/supabase/types";

export function getEmailProviderStatus(connection?: GmailConnectionRow | null) {
  return {
    ready: isGmailConnectionReady(connection),
    provider: "Gmail",
    from: connection?.gmail_address ?? ""
  };
}

export async function dispatchEmailCampaign({
  campaign,
  merchant,
  origin,
  gmailConnection,
  supabaseClient
}: {
  campaign: EmailCampaignRecord;
  merchant: MerchantRow;
  origin: string;
  gmailConnection?: GmailConnectionRow | null;
  supabaseClient?: SupabaseClient<Database>;
}) {
  const connection = gmailConnection ?? await getGmailConnection(merchant, supabaseClient);
  const provider = getEmailProviderStatus(connection);
  if (!provider.ready || !connection?.gmail_address) {
    throw new Error("Connectez Gmail pour envoyer vos campagnes depuis votre propre adresse.");
  }
  if (campaign.recipients.length === 0) throw new Error("Aucun abonné ne correspond à ce groupe de clients.");
  if (campaign.status === "sent") return campaign;

  const accessToken = await getFreshGmailAccessToken(connection, merchant, supabaseClient);
  let current = await saveEmailCampaign({ ...campaign, status: "sending", error_message: null, updated_at: new Date().toISOString() });
  const providerIds = [...current.provider_message_ids];
  let sentCount = current.sent_count;

  try {
    for (let index = sentCount; index < current.recipients.length; index += 1) {
      const recipient = current.recipients[index];
      const unsubscribeUrl = `${origin.replace(/\/$/, "")}/api/emailing/unsubscribe?campaign=${encodeURIComponent(current.id)}&recipient=${encodeURIComponent(recipient.token)}`;
      const messageId = await sendGmailMessage({
        accessToken,
        fromEmail: connection.gmail_address,
        fromName: merchant.business_name,
        to: recipient.email,
        subject: personalizeEmailText(current.content.subject, recipient),
        html: renderEmailHtml({ campaign: current, merchant, recipient, origin }),
        unsubscribeUrl,
        campaignId: current.id
      });
      providerIds.push(messageId);
      sentCount += 1;

      if (sentCount % 10 === 0 || sentCount === current.recipients.length) {
        current = await saveEmailCampaign({
          ...current,
          sent_count: sentCount,
          provider_message_ids: providerIds,
          updated_at: new Date().toISOString()
        });
      }
    }

    const now = new Date().toISOString();
    await upsertGmailConnection({
      merchant_id: merchant.id,
      status: "connected",
      last_checked_at: now,
      last_error: null
    }, merchant, supabaseClient);
    return saveEmailCampaign({
      ...current,
      status: "sent",
      sent_at: now,
      scheduled_at: null,
      error_message: null,
      updated_at: now
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Envoi impossible.";
    await saveEmailCampaign({
      ...current,
      status: "failed",
      sent_count: sentCount,
      provider_message_ids: providerIds,
      error_message: message,
      updated_at: new Date().toISOString()
    });
    await upsertGmailConnection({
      merchant_id: merchant.id,
      last_checked_at: new Date().toISOString(),
      last_error: message,
      ...(message.includes("renouvelée") ? { status: "error" as const } : {})
    }, merchant, supabaseClient).catch(() => null);
    throw new Error(message);
  }
}

export async function claimEmailCampaign(campaignId: string) {
  const campaign = await getEmailCampaign(campaignId);
  if (!campaign || campaign.status !== "scheduled" || !campaign.scheduled_at || new Date(campaign.scheduled_at) > new Date()) return null;
  return saveEmailCampaign({ ...campaign, status: "sending", updated_at: new Date().toISOString() });
}
