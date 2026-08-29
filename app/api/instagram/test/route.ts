import { NextResponse } from "next/server";
import { getInstagramFailureCode } from "@/lib/instagram-errors";
import { getValidInstagramAccessToken } from "@/lib/instagram-tokens";
import { getMerchant } from "@/lib/merchants";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";

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

  if (!hasInstagramOAuthConfig()) {
    return NextResponse.json({ error: "La connexion Instagram est temporairement indisponible." }, { status: 409 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    await getValidInstagramAccessToken({ merchantId: merchant.id, supabaseClient: supabase });
    return NextResponse.json({ ok: true, message: "Connexion Instagram vérifiée." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de vérifier la connexion Instagram pour le moment.";
    console.error("[instagram/test] failed", { merchantId: merchant.id, failureCode: getInstagramFailureCode(error) });
    return NextResponse.json({ error: message, failureCode: getInstagramFailureCode(error) }, { status: 409 });
  }
}
