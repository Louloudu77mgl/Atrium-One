import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function mapResetErrorMessage(error?: string | null) {
  const normalized = (error ?? "").toLowerCase();

  if (!normalized) {
    return "Impossible d’envoyer le lien de réinitialisation pour le moment.";
  }

  if (normalized.includes("fetch failed")) {
    return "Le serveur local n’arrive pas à contacter Supabase pour envoyer l’email. Vérifiez la connexion internet, le DNS, le VPN ou un bloqueur réseau.";
  }

  if (normalized.includes("redirect") || normalized.includes("not allowed") || normalized.includes("allow list")) {
    return "La réinitialisation n’est pas encore autorisée pour cette adresse du site. Ajoutez l’URL de retour dans Supabase puis réessayez.";
  }

  if (normalized.includes("rate limit") || normalized.includes("security purposes")) {
    return "Un email vient déjà d’être envoyé récemment. Attendez un peu avant de réessayer.";
  }

  if (normalized.includes("email")) {
    return "Vérifiez l’adresse email puis réessayez.";
  }

  return "Impossible d’envoyer le lien de réinitialisation pour le moment.";
}

export async function POST(request: Request) {
  try {
    if (!hasSupabaseEnv()) {
      return NextResponse.json({ ok: false, error: "Configuration Supabase manquante" }, { status: 500 });
    }

    const body = (await request.json()) as { email?: string; redirectTo?: string };
    const email = String(body.email ?? "").trim();
    const redirectTo = String(body.redirectTo ?? "").trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Ajoutez votre email pour recevoir le lien de réinitialisation." }, { status: 400 });
    }

    if (!redirectTo) {
      return NextResponse.json({ ok: false, error: "URL de retour manquante." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      console.error("[auth/reset-password]", "send_failed", {
        message: error.message,
        redirectTo
      });
      return NextResponse.json({ ok: false, error: mapResetErrorMessage(error.message) }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Si un compte existe, un email de réinitialisation vient d’être envoyé. Vous pouvez aussi renvoyer le lien."
    });
  } catch (error) {
    console.error("[auth/reset-password]", "unexpected_failure", error);
    const message = error instanceof Error ? mapResetErrorMessage(error.message) : "Impossible d’envoyer le lien de réinitialisation pour le moment.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
