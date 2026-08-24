import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { setStoredRcuDeveloperEmailConsent } from "@/lib/rcu-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const merchant = await getMerchant();
  if (!merchant) {
    return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  }

  const { clientId } = await params;
  const payload = await request.json().catch(() => null) as { enabled?: unknown } | null;

  if (typeof payload?.enabled !== "boolean") {
    return NextResponse.json({ error: "Valeur de consentement invalide." }, { status: 400 });
  }

  try {
    const consent = await setStoredRcuDeveloperEmailConsent({
      merchantId: merchant.id,
      customerKey: clientId,
      enabled: payload.enabled
    });

    revalidatePath("/fidelisation/clients");
    revalidatePath(`/fidelisation/clients/${clientId}`);
    revalidatePath("/emailing");
    revalidatePath("/automations");

    return NextResponse.json({
      ok: true,
      enabled: consent.enabled,
      source: consent.source
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de modifier le consentement de test.";
    const status = message === "Client introuvable." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
