import { NextResponse } from "next/server";
import { claimEmailCampaign, dispatchEmailCampaign } from "@/lib/emailing-provider";
import { listScheduledEmailCampaigns } from "@/lib/emailing-store";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ error: "Configuration Supabase admin manquante." }, { status: 500 });
  const campaigns = (await listScheduledEmailCampaigns()).slice(0, 10);
  const supabase = createSupabaseAdminClient();
  const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL_LOCAL || new URL(request.url).origin).replace(/\/$/, "");
  const results = [];
  for (const campaign of campaigns) {
    const claimed = await claimEmailCampaign(campaign.id);
    if (!claimed) { results.push({ id: campaign.id, status: "skipped" }); continue; }
    const { data: merchant } = await supabase.from("merchants").select("*").eq("id", campaign.merchant_id).maybeSingle();
    if (!merchant) { results.push({ id: campaign.id, status: "error", error: "Commerce introuvable." }); continue; }
    try {
      const sent = await dispatchEmailCampaign({ campaign: claimed, merchant, origin });
      results.push({ id: campaign.id, status: sent.status, sent: sent.sent_count });
    } catch (error) {
      results.push({ id: campaign.id, status: "error", error: error instanceof Error ? error.message : "Envoi impossible." });
    }
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
