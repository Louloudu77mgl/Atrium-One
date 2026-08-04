import { NextResponse } from "next/server";
import { estimateSmsParts } from "@/lib/sms";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeFrenchPhone } from "@/lib/sms-shared";
import type { CustomerRow } from "@/lib/supabase/types";

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
    customer_id?: string;
    customer?: Partial<Pick<CustomerRow, "first_name" | "last_name" | "phone" | "favorite_products" | "notes">>;
    message?: string;
    campaign_title?: string;
  };

  if (!payload.message?.trim()) {
    return NextResponse.json({ error: "Message requis." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  let customer: Pick<CustomerRow, "id" | "phone">;

  if (payload.customer_id) {
    const { data, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("merchant_id", merchant.id)
      .eq("id", payload.customer_id)
      .single();

    if (customerError) {
      return NextResponse.json({ error: customerError.message }, { status: 500 });
    }

    customer = data;
  } else {
    const phone = normalizeFrenchPhone(payload.customer?.phone ?? "");
    if (!phone) {
      return NextResponse.json({ error: "Téléphone du client test invalide." }, { status: 400 });
    }
    customer = { id: crypto.randomUUID(), phone };
  }

  const metrics = estimateSmsParts(payload.message);
  const { error } = await supabase.from("sms_messages").insert({
    merchant_id: merchant.id,
    customer_id: customer.id,
    phone: customer.phone,
    message_text: payload.message.trim(),
    status: "test_sent",
    sms_parts: metrics.parts,
    sent_at: new Date().toISOString()
  });

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({ error: "Tables SMS absentes. Exécutez supabase/sms-module.sql puis réessayez." }, { status: 400 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
