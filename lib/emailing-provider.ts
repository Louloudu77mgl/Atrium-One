import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailCampaign, saveEmailCampaign } from "@/lib/emailing-store";
import { personalizeEmailText, renderEmailHtml } from "@/lib/emailing-template";
import {
  getGmailConnection,
  isGmailConnectionReady,
  upsertGmailConnection
} from "@/lib/gmail-connections";
import { sendGmailMessage } from "@/lib/gmail-messages";
import { getFreshGmailAccessToken } from "@/lib/gmail-tokens";
import {
  getSmtpConnection,
  isSmtpConnectionReady,
  updateSmtpConnectionStatus
} from "@/lib/smtp-connections";
import { sendSmtpMessage } from "@/lib/smtp-messages";
import type { EmailCampaignRecord } from "@/lib/emailing-types";
import type {
  Database,
  GmailConnectionRow,
  MerchantRow,
  SmtpConnectionRow
} from "@/lib/supabase/types";

export function getEmailProviderStatus(
  gmailConnection?: GmailConnectionRow | null,
  smtpConnection?: SmtpConnectionRow | null
) {
  if (isSmtpConnectionReady(smtpConnection)) {
    return {
      ready: true,
      type: "smtp" as const,
      provider: smtpConnection?.provider || "SMTP",
      from: smtpConnection?.email_address ?? ""
    };
  }

  if (isGmailConnectionReady(gmailConnection)) {
    return {
      ready: true,
      type: "gmail" as const,
      provider: "Gmail",
      from: gmailConnection?.gmail_address ?? ""
    };
  }

  return {
    ready: false,
    type: null,
    provider: null,
    from: ""
  };
}

export async function dispatchEmailCampaign({
  campaign,
  merchant,
  origin,
  gmailConnection,
  smtpConnection,
  supabaseClient
}: {
  campaign: EmailCampaignRecord;
  merchant: MerchantRow;
  origin: string;
  gmailConnection?: GmailConnectionRow | null;
  smtpConnection?: SmtpConnectionRow | null;
  supabaseClient?: SupabaseClient<Database>;
}) {
  const [gmail, smtp] = await Promise.all([
    gmailConnection !== undefined
      ? Promise.resolve(gmailConnection)
      : getGmailConnection(merchant, supabaseClient),
    smtpConnection !== undefined
      ? Promise.resolve(smtpConnection)
      : getSmtpConnection(merchant, supabaseClient)
  ]);

  const provider = getEmailProviderStatus(gmail, smtp);

  if (!provider.ready || !provider.type) {
    throw new Error(
      "Connectez Gmail ou configurez un serveur SMTP pour envoyer vos campagnes."
    );
  }

  if (campaign.recipients.length === 0) {
    throw new Error(
      "Aucun abonné ne correspond à ce groupe de clients."
    );
  }

  if (campaign.status === "sent") {
    return campaign;
  }

  let gmailAccessToken: string | null = null;

  if (provider.type === "gmail") {
    if (!gmail?.gmail_address) {
      throw new Error("Connexion Gmail invalide.");
    }

    gmailAccessToken = await getFreshGmailAccessToken(
      gmail,
      merchant,
      supabaseClient
    );
  }

  if (provider.type === "smtp" && !smtp) {
    throw new Error("Connexion SMTP invalide.");
  }

  let current = await saveEmailCampaign({
    ...campaign,
    status: "sending",
    error_message: null,
    updated_at: new Date().toISOString()
  });

  const providerIds = [...current.provider_message_ids];
  let sentCount = current.sent_count;

  try {
    for (
      let index = sentCount;
      index < current.recipients.length;
      index += 1
    ) {
      const recipient = current.recipients[index];

      const unsubscribeUrl =
        `${origin.replace(/\/$/, "")}` +
        `/api/emailing/unsubscribe` +
        `?campaign=${encodeURIComponent(current.id)}` +
        `&recipient=${encodeURIComponent(recipient.token)}`;

      const subject = personalizeEmailText(
        current.content.subject,
        recipient
      );

      const html = renderEmailHtml({
        campaign: current,
        merchant,
        recipient,
        origin
      });

      let messageId: string;

      if (provider.type === "smtp") {
        if (!smtp) {
          throw new Error("Connexion SMTP introuvable.");
        }

        messageId = await sendSmtpMessage({
          connection: smtp,
          fromName:
            smtp.from_name ||
            merchant.business_name,
          to: recipient.email,
          subject,
          html,
          unsubscribeUrl,
          campaignId: current.id
        });
      } else {
        if (!gmail?.gmail_address || !gmailAccessToken) {
          throw new Error("Connexion Gmail invalide.");
        }

        messageId = await sendGmailMessage({
          accessToken: gmailAccessToken,
          fromEmail: gmail.gmail_address,
          fromName: merchant.business_name,
          to: recipient.email,
          subject,
          html,
          unsubscribeUrl,
          campaignId: current.id
        });
      }

      providerIds.push(messageId);
      sentCount += 1;

      if (
        sentCount % 10 === 0 ||
        sentCount === current.recipients.length
      ) {
        current = await saveEmailCampaign({
          ...current,
          sent_count: sentCount,
          provider_message_ids: providerIds,
          updated_at: new Date().toISOString()
        });
      }
    }

    const now = new Date().toISOString();

    if (provider.type === "smtp" && smtp) {
      await updateSmtpConnectionStatus(
        {
          merchant_id: merchant.id,
          status: "connected",
          last_checked_at: now,
          last_error: null
        },
        merchant,
        supabaseClient
      );
    }

    if (provider.type === "gmail") {
      await upsertGmailConnection(
        {
          merchant_id: merchant.id,
          status: "connected",
          last_checked_at: now,
          last_error: null
        },
        merchant,
        supabaseClient
      );
    }

    return saveEmailCampaign({
      ...current,
      status: "sent",
      sent_at: now,
      scheduled_at: null,
      error_message: null,
      updated_at: now
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Envoi impossible.";

    await saveEmailCampaign({
      ...current,
      status: "failed",
      sent_count: sentCount,
      provider_message_ids: providerIds,
      error_message: message,
      updated_at: new Date().toISOString()
    });

    if (provider.type === "smtp" && smtp) {
      await updateSmtpConnectionStatus(
        {
          merchant_id: merchant.id,
          last_checked_at: new Date().toISOString(),
          last_error: message
        },
        merchant,
        supabaseClient
      ).catch(() => null);
    }

    if (provider.type === "gmail") {
      await upsertGmailConnection(
        {
          merchant_id: merchant.id,
          last_checked_at: new Date().toISOString(),
          last_error: message,
          ...(message.includes("renouvelée")
            ? { status: "error" as const }
            : {})
        },
        merchant,
        supabaseClient
      ).catch(() => null);
    }

    throw new Error(message);
  }
}

export async function claimEmailCampaign(
  campaignId: string
) {
  const campaign = await getEmailCampaign(campaignId);

  if (
    !campaign ||
    campaign.status !== "scheduled" ||
    !campaign.scheduled_at ||
    new Date(campaign.scheduled_at) > new Date()
  ) {
    return null;
  }

  return saveEmailCampaign({
    ...campaign,
    status: "sending",
    updated_at: new Date().toISOString()
  });
}
