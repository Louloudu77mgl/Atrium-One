import { NextResponse } from "next/server";
import { getEmailingDashboardData } from "@/lib/emailing-data";
import { dispatchEmailCampaign, getEmailProviderStatus } from "@/lib/emailing-provider";
import { filterEmailSubscribers, getEmailSegmentLabel } from "@/lib/emailing-segments";
import { createEmailCampaign, createEmailRecipients, getEmailCampaign, updateEmailCampaign } from "@/lib/emailing-store";
import { DEFAULT_EMAIL_CONTENT, EMAIL_CAMPAIGN_TYPES, type EmailCampaignContent, type EmailCampaignRecord, type EmailCampaignType, type EmailSegmentMode, type EmailSegmentRule } from "@/lib/emailing-types";
import { getMerchant } from "@/lib/merchants";
import { getReviews } from "@/lib/reviews";

export const maxDuration = 60;

function normalizeContent(value: Partial<EmailCampaignContent> | undefined): EmailCampaignContent {
  const content = { ...DEFAULT_EMAIL_CONTENT, ...value };
  return {
    subject: String(content.subject).trim().slice(0, 120),
    preheader: String(content.preheader).trim().slice(0, 180),
    heading: String(content.heading).trim().slice(0, 180),
    body: String(content.body).trim().slice(0, 6000),
    ctaLabel: String(content.ctaLabel).trim().slice(0, 60),
    ctaUrl: String(content.ctaUrl).trim().slice(0, 1000),
    signature: String(content.signature).trim().slice(0, 600),
    imageUrl: String(content.imageUrl).trim().slice(0, 1000),
    showLogo: content.showLogo !== false,
    primaryColor: String(content.primaryColor),
    backgroundColor: String(content.backgroundColor),
    buttonColor: String(content.buttonColor)
  };
}

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const payload = await request.json() as {
    name?: string;
    campaignType?: string;
    brief?: string;
    segmentRules?: EmailSegmentRule[];
    segmentMode?: EmailSegmentMode;
    content?: Partial<EmailCampaignContent>;
    action?: "draft" | "scheduled" | "send";
    scheduledAt?: string | null;
    campaignId?: string;
  };
  if (!EMAIL_CAMPAIGN_TYPES.includes(payload.campaignType as EmailCampaignType)) return NextResponse.json({ error: "Choisissez un type de campagne." }, { status: 400 });
  const rules = Array.isArray(payload.segmentRules) ? payload.segmentRules.slice(0, 8) : [];
  if (rules.length === 0) return NextResponse.json({ error: "Choisissez au moins un groupe de clients." }, { status: 400 });
  const mode: EmailSegmentMode = payload.segmentMode === "any" ? "any" : "all";
  const reviews = await getReviews();
  const data = await getEmailingDashboardData(merchant, reviews);
  const audience = filterEmailSubscribers(data.subscribers, rules, mode);
  const action = payload.action ?? "draft";
  if (action !== "draft" && audience.length === 0) return NextResponse.json({ error: "Aucun abonné consenti ne correspond à ce segment." }, { status: 400 });
  if (action === "send" && !getEmailProviderStatus().ready) return NextResponse.json({ error: "Ajoutez RESEND_API_KEY et EMAIL_FROM pour activer l’envoi réel. Le brouillon peut déjà être enregistré." }, { status: 409 });
  const scheduledAt = action === "scheduled" && payload.scheduledAt ? new Date(payload.scheduledAt) : null;
  if (action === "scheduled" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) return NextResponse.json({ error: "Choisissez une date future pour programmer la campagne." }, { status: 400 });
  const content = normalizeContent(payload.content);
  if (!content.subject || !content.heading || !content.body) return NextResponse.json({ error: "Objet, titre et contenu sont requis." }, { status: 400 });
  const recipients = createEmailRecipients(audience);
  const campaignPayload: Omit<EmailCampaignRecord, "id" | "created_at" | "updated_at"> = {
    merchant_id: merchant.id,
    name: payload.name?.trim().slice(0, 100) || content.subject,
    campaign_type: payload.campaignType as EmailCampaignType,
    brief: payload.brief?.trim().slice(0, 1000) || "",
    segment_rules: rules,
    segment_mode: mode,
    segment_label: getEmailSegmentLabel(rules, mode),
    recipient_count: recipients.length,
    recipients,
    content,
    status: action === "scheduled" ? "scheduled" : "draft",
    scheduled_at: scheduledAt?.toISOString() ?? null,
    sent_at: null,
    sent_count: 0,
    open_count: 0,
    click_count: 0,
    open_rate: 0,
    click_rate: 0,
    provider_message_ids: [],
    error_message: null
  };
  let campaign;
  if (payload.campaignId) {
    const existing = await getEmailCampaign(payload.campaignId);
    if (!existing || existing.merchant_id !== merchant.id) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
    if (existing.status === "sent" || existing.status === "sending") return NextResponse.json({ error: "Une campagne déjà envoyée ne peut plus être modifiée." }, { status: 400 });
    campaign = await updateEmailCampaign(existing.id, merchant.id, campaignPayload);
  } else {
    campaign = await createEmailCampaign(campaignPayload);
  }
  if (action !== "send") return NextResponse.json({ campaign });
  try {
    const sentCampaign = await dispatchEmailCampaign({ campaign, merchant, origin: new URL(request.url).origin });
    return NextResponse.json({ campaign: sentCampaign });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi impossible.", campaignId: campaign.id }, { status: 502 });
  }
}
