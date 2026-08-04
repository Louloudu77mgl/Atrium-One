import { headers } from "next/headers";

export function mapGoogleLoginErrorMessage(error?: string | null) {
  const normalized = (error ?? "").toLowerCase();

  if (!normalized) {
    return "Connexion Google indisponible pour le moment.";
  }

  if (normalized.includes("access_denied")) {
    return "La connexion Google a été annulée.";
  }

  if (normalized.includes("code verifier") || normalized.includes("code_verifier")) {
    return "La connexion Google a expiré avant la fin. Réessayez.";
  }

  if (normalized.includes("invalid request") || normalized.includes("invalid_grant")) {
    return "La connexion Google a échoué. Réessayez dans quelques secondes.";
  }

  if (normalized.includes("provider is not enabled")) {
    return "La connexion Google n’est pas encore activée sur ce projet.";
  }

  return "Impossible de finaliser la connexion Google. Réessayez.";
}

export function mapLoginPageErrorMessage(error?: string | null) {
  if (!error) {
    return null;
  }

  if (error === "email_login_failed") {
    return "Email ou mot de passe incorrect.";
  }

  if (error === "google_login_unavailable") {
    return "La connexion Google n’est pas disponible pour le moment.";
  }

  if (error === "google_session_missing") {
    return "La session Google n’a pas pu être créée. Réessayez.";
  }

  if (error === "google_code_missing") {
    return "Le retour Google est incomplet. Réessayez.";
  }

  if (error === "reset_password_failed") {
    return "Impossible d’envoyer le lien de réinitialisation pour le moment.";
  }

  if (error === "Email requis") {
    return "Ajoutez votre email pour recevoir le lien de réinitialisation.";
  }

  if (error.includes("Configuration Supabase")) {
    return error;
  }

  if (error.toLowerCase().includes("google") || error.toLowerCase().includes("access_denied") || error.toLowerCase().includes("invalid_grant")) {
    return mapGoogleLoginErrorMessage(error);
  }

  return error;
}

export async function getAppOriginFromHeaders() {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");

  if (host) {
    const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.)/i.test(host);
    const protocol = forwardedProto ?? (isLocalHost ? "http" : "https");
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function logGoogleLoginEvent(event: string, details: Record<string, unknown> = {}) {
  console.info("[auth/google]", event, details);
}

export function logGoogleLoginError(event: string, details: Record<string, unknown> = {}) {
  console.error("[auth/google]", event, details);
}
