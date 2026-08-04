import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { parseCustomerCsv } from "@/lib/sms";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isMissingTable(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("could not find the table") || normalized.includes("schema cache");
}

export async function POST(request: Request) {
  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  }

  const payload = (await request.json()) as { csv?: string };
  const rows = parseCustomerCsv(payload.csv ?? "");

  if (rows.length === 0) {
    return NextResponse.json({ error: "Aucune ligne valide trouvée dans le CSV." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  for (const row of rows) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        {
          merchant_id: merchant.id,
          first_name: row.first_name,
          last_name: row.last_name,
          phone: row.phone!,
          opt_in_sms: row.opt_in_sms,
          sms_unsubscribed: !row.opt_in_sms,
          favorite_products: row.favorite_products,
          last_purchase_date: row.last_purchase_date,
          notes: row.notes
        },
        { onConflict: "merchant_id,phone" }
      )
      .select("*")
      .single();

    if (customerError) {
      if (isMissingTable(customerError.message)) {
        return NextResponse.json({ error: "Tables SMS absentes. Exécutez supabase/sms-module.sql puis réessayez." }, { status: 400 });
      }

      return NextResponse.json({ error: customerError.message }, { status: 500 });
    }

    if (row.event_product_name) {
      const { error: eventError } = await supabase.from("customer_events").insert({
        merchant_id: merchant.id,
        customer_id: customer.id,
        event_type: "purchase",
        product_name: row.event_product_name,
        happened_at: row.last_purchase_date ?? new Date().toISOString(),
        notes: row.notes
      });

      if (eventError && !isMissingTable(eventError.message)) {
        return NextResponse.json({ error: eventError.message }, { status: 500 });
      }
    }
  }

  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customers: customers ?? [], imported: rows.length });
}
