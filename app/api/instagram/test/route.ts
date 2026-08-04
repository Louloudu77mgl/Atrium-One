import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getInstagramConnection, upsertInstagramConnection } from "@/lib/instagram-connections";
import { hasInstagramOAuthConfig } from "@/lib/instagram-oauth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

type MetaProfileResponse = {
  id?: string;
  username?: string;
  error?: {
    message?: string;
  };
};

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

  const connection = await getInstagramConnection(merchant);
  if (!connection?.instagram_account_id || !connection.access_token_encrypted) {
    return NextResponse.json({ error: "Connectez d’abord un compte Instagram professionnel." }, { status: 409 });
  }

  const version = process.env.INSTAGRAM_GRAPH_API_VERSION ?? "v23.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${connection.instagram_account_id}?${new URLSearchParams({
    fields: "id,username",
    access_token: connection.access_token_encrypted
  }).toString()}`, {
    cache: "no-store"
  });

  const data = (await response.json()) as MetaProfileResponse;

  if (!response.ok || !data.id) {
    const message = mapInstagramTestError(data.error?.message);
    await upsertInstagramConnection({
      merchant_id: merchant.id,
      status: "error",
      last_error: message,
      last_sync_at: new Date().toISOString()
    }, merchant);
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const now = new Date().toISOString();
  await upsertInstagramConnection({
    merchant_id: merchant.id,
    instagram_username: data.username ?? connection.instagram_username,
    status: "connected",
    last_error: null,
    last_sync_at: now
  }, merchant);

  return NextResponse.json({
    ok: true,
    message: "Connexion Instagram vérifiée."
  });
}

function mapInstagramTestError(message?: string) {
  const value = (message ?? "").toLowerCase();
  if (value.includes("expired")) return "Votre connexion Instagram doit être renouvelée.";
  if (value.includes("permission")) return "Certaines autorisations nécessaires n’ont pas été accordées.";
  if (value.includes("professional")) return "Passez votre compte Instagram en compte professionnel.";
  return "Impossible de vérifier la connexion Instagram pour le moment.";
}
