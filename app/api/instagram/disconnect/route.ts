import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { upsertInstagramConnection } from "@/lib/instagram-connections";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  }

  const merchant = await getMerchant();
  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  }

  await upsertInstagramConnection({
    merchant_id: merchant.id,
    instagram_account_id: null,
    instagram_username: null,
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    status: "disconnected",
    last_error: null,
    last_sync_at: new Date().toISOString()
  }, merchant);

  return NextResponse.json({ ok: true });
}
