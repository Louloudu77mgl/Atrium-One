import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { getCrmGmailConnection, upsertCrmGmailConnection } from "@/lib/crm/gmail";
import { getCurrentUser } from "@/lib/supabase/server";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const connection = await getCrmGmailConnection();
  const token = connection?.refresh_token_encrypted ?? connection?.access_token_encrypted;
  if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000) }).catch(() => null);
  await upsertCrmGmailConnection({ access_token_encrypted: null, refresh_token_encrypted: null, token_expires_at: null, granted_scopes: [], status: "disconnected", last_checked_at: new Date().toISOString(), last_error: null });
  revalidatePath("/crm/settings");
  return NextResponse.json({ ok: true });
}
