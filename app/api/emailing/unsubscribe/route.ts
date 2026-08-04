import { NextResponse } from "next/server";
import { getEmailCampaign, suppressEmailAddress } from "@/lib/emailing-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const campaign = await getEmailCampaign(url.searchParams.get("campaign") ?? "");
  const recipient = campaign?.recipients.find((item) => item.token === url.searchParams.get("recipient"));
  if (campaign && recipient) await suppressEmailAddress(campaign.merchant_id, recipient.email).catch(() => null);
  const message = recipient ? "Votre désabonnement est bien enregistré." : "Ce lien de désabonnement n’est plus valide.";
  return new NextResponse(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Désabonnement</title><body style="margin:0;background:#f8f5ff;font-family:Arial,sans-serif;color:#211432"><main style="max-width:560px;margin:80px auto;padding:40px;background:#fff;border-radius:24px;text-align:center;box-shadow:0 18px 50px rgba(76,29,149,.12)"><div style="font-size:42px">✓</div><h1>${message}</h1><p>Vous ne recevrez plus les campagnes e-mail de cette boutique.</p></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
