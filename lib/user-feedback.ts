const DEFAULT_ERROR_MESSAGE = "Une erreur est survenue. Réessayez dans quelques instants.";

function normalizeMessage(message?: string | null) {
  return message?.trim() ?? "";
}

export function getDefaultUserErrorMessage() {
  return DEFAULT_ERROR_MESSAGE;
}

export function mapUserFacingError(message?: string | null, fallback = DEFAULT_ERROR_MESSAGE) {
  const normalized = normalizeMessage(message);

  if (!normalized) {
    return fallback;
  }

  const lower = normalized.toLowerCase();
  const missingColumn = normalized.match(/Could not find the ['"]([^'"]+)['"] column/i)?.[1];

  if (lower.includes("aborterror") || lower.includes("timed out") || lower.includes("timeout")) {
    return "Le chargement prend trop de temps. Réessayez.";
  }

  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return "Connexion momentanément indisponible. Réessayez.";
  }

  if (lower.includes("schema cache") || lower.includes("could not find the table") || lower.includes("column") && lower.includes("cache")) {
    return missingColumn
      ? `Le réglage « ${missingColumn} » n’est pas encore disponible dans la base de données.`
      : "La structure des réglages n’est pas à jour dans la base de données.";
  }

  if (lower.includes("configuration supabase") || lower.includes("supabase manquante")) {
    return "La plateforme n’est pas encore complètement configurée. Réessayez un peu plus tard.";
  }

  if (lower.includes("openai_api_key") || lower.includes("openai")) {
    return "Hans n’est pas disponible pour le moment. Réessayez un peu plus tard.";
  }

  if (lower.includes("instagram") && lower.includes("non configur")) {
    return "La connexion Instagram n’est pas encore disponible pour votre compte.";
  }

  if (lower.includes("google") && lower.includes("expir")) {
    return "La connexion Google a expiré. Reconnectez votre compte puis réessayez.";
  }

  if (
    lower.includes("mybusiness.googleapis.com") && lower.includes("désactiv") ||
    lower.includes("google my business api has not been used") ||
    lower.includes("service_disabled")
  ) {
    return "L’API nécessaire à la lecture des avis Google est désactivée dans votre projet Google Cloud.";
  }

  if (lower.includes("quota exceeded") || lower.includes("requests per minute")) {
    return "Google a temporairement bloqué l’import car trop de requêtes ont été envoyées en peu de temps. Attendez 1 à 2 minutes puis relancez la synchronisation.";
  }

  if (lower.includes("client secret") && lower.includes("invalid")) {
    return "La connexion OAuth Google Business a été refusée. Vérifiez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et l’URL de redirection autorisée dans Google Cloud, puis redéployez.";
  }

  if (lower.includes("tables sms absentes")) {
    return "Le module SMS n’est pas encore activé dans la base de données de ce compte.";
  }

  return normalized.length > 160 ? fallback : normalized;
}

export function getUserErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE) {
  if (error instanceof Error) {
    return mapUserFacingError(error.message, fallback);
  }

  if (typeof error === "string") {
    return mapUserFacingError(error, fallback);
  }

  return fallback;
}
