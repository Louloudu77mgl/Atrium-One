import { NextResponse } from "next/server";
import { generatePersonalizedSms, type SmsTone } from "@/lib/sms";
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
    customer?: Partial<Pick<CustomerRow, "first_name" | "last_name" | "phone" | "favorite_products" | "notes" | "last_purchase_date">>;
    tone?: SmsTone;
    objective?: string;
  };

  let customer: Pick<CustomerRow, "first_name" | "favorite_products" | "last_purchase_date" | "notes" | "phone">;

  if (payload.customer_id) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("merchant_id", merchant.id)
      .eq("id", payload.customer_id)
      .single();

    if (error) {
      if (isMissingTable(error.message)) {
        return NextResponse.json({ error: "Tables SMS absentes. Exécutez supabase/sms-module.sql puis réessayez." }, { status: 400 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    customer = data;
  } else if (payload.customer?.first_name?.trim() && normalizeFrenchPhone(payload.customer.phone ?? "") ) {
    customer = {
      first_name: payload.customer.first_name.trim(),
      favorite_products: payload.customer.favorite_products ?? [],
      last_purchase_date: payload.customer.last_purchase_date ?? null,
      notes: payload.customer.notes ?? null,
      phone: normalizeFrenchPhone(payload.customer.phone ?? "")!
    };
  } else {
    return NextResponse.json({ error: "Ajoutez un client test ou importez un client." }, { status: 400 });
  }

  const message = generatePersonalizedSms({
    customer,
    merchant,
    tone: payload.tone ?? "chaleureux",
    objective: payload.objective ?? "Nous avions envie de prendre de vos nouvelles",
    brandTone: merchant.response_tone,
    commerceType: merchant.business_type
  });

  return NextResponse.json({ message, phone: customer.phone });
}
