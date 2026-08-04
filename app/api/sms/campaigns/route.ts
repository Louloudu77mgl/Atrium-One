import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SmsCampaignRow } from "@/lib/supabase/types";

function isMissingTable(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("could not find the table") || normalized.includes("schema cache");
}

export async function POST(request: Request) {
  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    title?: string;
    objective?: string;
    audience_label?: string;
    audience_mode?: string;
    tone?: SmsCampaignRow["tone"];
    message_template?: string;
    test_customer_id?: string | null;
    status?: SmsCampaignRow["status"];
  };

  if (!payload.title?.trim() || !payload.objective?.trim()) {
    return NextResponse.json({ error: "Titre et objectif requis." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("sms_campaigns")
    .insert({
      merchant_id: merchant.id,
      title: payload.title.trim(),
      objective: payload.objective.trim(),
      audience_label: payload.audience_label?.trim() || "Tous les clients opt-in",
      audience_rule: { mode: payload.audience_mode ?? "all" },
      tone: payload.tone ?? "chaleureux",
      message_template: payload.message_template?.trim() || null,
      status: payload.status ?? "draft",
      test_customer_id: payload.test_customer_id ?? null,
      scheduled_at: payload.status === "scheduled" ? new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() : null,
      sent_at: payload.status === "sent" ? new Date().toISOString() : null
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({ error: "Tables SMS absentes. Exécutez supabase/sms-module.sql puis réessayez." }, { status: 400 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
