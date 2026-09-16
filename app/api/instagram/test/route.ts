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

  const merchant = await getMerchant(user.id);
  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  }

  if (!hasInstagramOAuthConfig()) {
    return NextResponse.json({ error: "La connexion Instagram est temporairement indisponible." }, { status: 409 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { connection } = await getValidInstagramAccessToken({ merchantId: merchant.id, supabaseClient: supabase });
    const storyEligible = connection.instagram_account_type === "BUSINESS";
    return NextResponse.json({
      ok: true,
      message: "Connexion Instagram vérifiée.",
      accountType: connection.instagram_account_type,
      username: connection.instagram_username,
      storyEligible,
      storyMessage: storyEligible
        ? "Compte Business vérifié. Vous pouvez tenter la publication ; Instagram vérifiera aussi les autorisations et le média lors de l’envoi."
        : "Instagram exige un compte Business pour les Stories via API. Passez votre compte en Entreprise dans Instagram, puis vérifiez à nouveau. Vous pouvez aussi télécharger la Story et la publier depuis Instagram."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de vérifier la connexion Instagram pour le moment.";
    console.error("[instagram/test] failed", { merchantId: merchant.id, failureCode: getInstagramFailureCode(error) });
    return NextResponse.json({ error: message, failureCode: getInstagramFailureCode(error) }, { status: 409 });
  }
}
