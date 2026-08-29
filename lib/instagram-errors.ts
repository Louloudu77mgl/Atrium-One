export type InstagramFailureCode =
  | "token_expired"
  | "token_revoked"
  | "permissions_insufficient"
  | "account_inaccessible"
  | "refresh_failed"
  | "media_container_failed"
  | "media_processing_failed"
  | "media_publish_failed"
  | "connection_invalid"
  | "graph_api_error";

export type InstagramIntegrationErrorDetails = {
  action: string;
  provider: "meta";
  method: "GET" | "POST";
  endpoint: string;
  http_status: number | null;
  api_error: string;
  failure_code: InstagramFailureCode;
  timestamp: string;
};

export class InstagramIntegrationError extends Error {
  constructor(
    message: string,
    readonly details: InstagramIntegrationErrorDetails,
    readonly metaCode?: number
  ) {
    super(message);
    this.name = "InstagramIntegrationError";
  }
}

export function getInstagramIntegrationErrorDetails(error: unknown) {
  return error instanceof InstagramIntegrationError ? error.details : null;
}

export function getInstagramFailureCode(error: unknown): InstagramFailureCode {
  return error instanceof InstagramIntegrationError ? error.details.failure_code : "graph_api_error";
}

export function createInstagramIntegrationError({
  message,
  apiError = message,
  failureCode,
  action,
  method,
  endpoint,
  httpStatus = null,
  metaCode
}: {
  message: string;
  apiError?: string;
  failureCode: InstagramFailureCode;
  action: string;
  method: "GET" | "POST";
  endpoint: string;
  httpStatus?: number | null;
  metaCode?: number;
}) {
  return new InstagramIntegrationError(message, {
    action,
    provider: "meta",
    method,
    endpoint,
    http_status: httpStatus,
    api_error: redactInstagramSensitiveData(apiError),
    failure_code: failureCode,
    timestamp: new Date().toISOString()
  }, metaCode);
}

export function redactInstagramSensitiveData(value: string) {
  return value
    .replace(/([?&]access_token=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(access[_ -]?token["'\s:=]+)[^\s,"'}&]+/gi, "$1[REDACTED]")
    .replace(/(client[_ -]?secret["'\s:=]+)[^\s,"'}&]+/gi, "$1[REDACTED]");
}

export function classifyInstagramMetaError(error: { message?: string; code?: number } | undefined) {
  const message = error?.message?.trim() || "Erreur Instagram inconnue.";
  const normalized = message.toLocaleLowerCase("en-US");

  if (error?.code === 190 && (normalized.includes("expired") || normalized.includes("session has expired"))) {
    return {
      failureCode: "token_expired" as const,
      userMessage: "Votre connexion Instagram a expiré. Reconnectez Instagram pour reprendre les publications automatiques.",
      apiMessage: message
    };
  }
  if (error?.code === 190) {
    return {
      failureCode: "token_revoked" as const,
      userMessage: "Votre connexion Instagram doit être renouvelée. Reconnectez Instagram pour reprendre les publications.",
      apiMessage: message
    };
  }
  if (error?.code === 10 || error?.code === 200 || normalized.includes("permission")) {
    return {
      failureCode: "permissions_insufficient" as const,
      userMessage: "Certaines autorisations Instagram nécessaires n’ont pas été accordées. Reconnectez Instagram.",
      apiMessage: message
    };
  }
  if (error?.code === 100 && normalized.includes("unsupported request")) {
    return {
      failureCode: "account_inaccessible" as const,
      userMessage: "Le compte Instagram connecté doit être vérifié avant de publier.",
      apiMessage: message
    };
  }
  return {
    failureCode: "graph_api_error" as const,
    userMessage: "Instagram n’a pas pu terminer cette action. Réessayez dans quelques instants.",
    apiMessage: message
  };
}
