import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { parseCustomerCsv } from "@/lib/sms";
import { saveStoredRcuLead } from "@/lib/rcu-store";

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  }

  const payload = (await request.json()) as { csv?: string };
  const rows = parseCustomerCsv(payload.csv ?? "");

  if (rows.length === 0) {
    return NextResponse.json({ error: "Aucun contact valide trouvé. Vérifiez les colonnes Prénom, Nom et adresse mail." }, { status: 400 });
  }

  const importedAt = new Date();
  const contacts = rows.slice(0, 1000).map((row, index) => ({
    id: randomUUID(),
    form_id: "import",
    form_slug: "import-clients",
    form_title: "Import clients",
    merchant_id: merchant.id,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone ?? "",
    email: row.email,
    favorite_products: row.favorite_products.join(", ") || null,
    consent_sms: row.opt_in_sms,
    consent_email: row.opt_in_email,
    birthday: row.birthday,
    promo_code: null,
    promo_label: null,
    promo_value: null,
    submitted_at: new Date(importedAt.getTime() + index).toISOString(),
    source: "import" as const,
    notes: row.notes,
    last_purchase_date: row.last_purchase_date
  }));

  for (let index = 0; index < contacts.length; index += 20) {
    await Promise.all(contacts.slice(index, index + 20).map((contact) => saveStoredRcuLead(contact)));
  }

  return NextResponse.json({ imported: Math.min(rows.length, 1000) });
}
