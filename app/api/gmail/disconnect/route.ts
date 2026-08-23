import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getGmailConnection, upsertGmailConnection } from "@/lib/gmail-connections";
import { getMerchant } from "@/lib/merchants";

export async function POST() {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  const connection = await getGmailConnection(merchant);
  const token = connection?.refresh_token_encrypted ?? connection?.access_token_encrypted;

  if (token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    }).catch(() => null);
  }

  await upsertGmailConnection({
    merchant_id: merchant.id,
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    token_expires_at: null,
    granted_scopes: [],
    status: "disconnected",
    last_checked_at: new Date().toISOString(),
    last_error: null
  }, merchant);
  revalidatePath("/emailing");
  revalidatePath("/integrations");
  return NextResponse.json({ ok: true });
}
