import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getGoogleConnection, upsertGoogleConnection } from "@/lib/google-connections";
import { getMerchant } from "@/lib/merchants";

export async function POST() {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  const connection = await getGoogleConnection(merchant);
  const token = connection?.refresh_token_encrypted ?? connection?.access_token_encrypted;

  if (token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    }).catch(() => null);
  }

  await upsertGoogleConnection({
    merchant_id: merchant.id,
    google_account_email: null,
    google_location_id: null,
    google_location_name: null,
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    granted_scopes: [],
    status: "disconnected",
    last_error: null,
    last_sync_at: null
  }, merchant);
  revalidatePath("/integrations");
  revalidatePath("/reviews");
  return NextResponse.json({ ok: true });
}
