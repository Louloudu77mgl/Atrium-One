import { NextResponse } from "next/server";
import { getEmailCampaign, recordEmailEvent } from "@/lib/emailing-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaign") ?? "";
  const recipientToken = url.searchParams.get("recipient") ?? "";
  const campaign = await getEmailCampaign(campaignId);
  if (!campaign || !campaign.recipients.some((recipient) => recipient.token === recipientToken)) return NextResponse.redirect(new URL("/", request.url));
  await recordEmailEvent(campaignId, recipientToken, "click").catch(() => null);
  try {
    const destination = new URL(campaign.content.ctaUrl);
    if (!["http:", "https:"].includes(destination.protocol)) throw new Error("Invalid protocol");
    return NextResponse.redirect(destination);
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }
}
