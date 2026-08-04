import { NextResponse } from "next/server";
import { getRcuValidationKey, submitRcuLead } from "@/lib/rcu-server";
import { getStoredRcuForm } from "@/lib/rcu-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const payload = (await request.json()) as {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    favorite_products?: string;
    consent_sms?: boolean;
    consent_email?: boolean;
    birthday?: string;
    privacy_consent?: boolean;
    review_confirmed?: boolean;
    visit_code?: string;
  };

  const form = await getStoredRcuForm(slug);
  if (!form) {
    return NextResponse.json({ error: "Formulaire RCU introuvable." }, { status: 404 });
  }

  try {
    const result = await submitRcuLead({
      form,
      payload: { ...payload, validation_key: getRcuValidationKey(request.headers) }
    });

    return NextResponse.json({
      ok: true,
      promoCode: result.promoCode,
      promoLabel: form.discount_label,
      promoValue: form.discount_value,
      successMessage: result.successMessage,
      playToken: result.playToken,
      walletToken: result.walletToken,
      duplicate: result.duplicate,
      result: result.result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d’enregistrer votre demande.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
