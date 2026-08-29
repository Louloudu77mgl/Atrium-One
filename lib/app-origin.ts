const productionOrigin = "https://app.atrium-one.fr";

export function getAppOriginFromRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestUrl = new URL(request.url);
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.)/i.test(host);
  const protocol = forwardedProto ?? (isLocalHost ? "http" : "https");

  return `${protocol}://${host}`.replace(/\/$/, "");
}

export function getConfiguredAppOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (configuredOrigin && (process.env.NODE_ENV !== "production" || !isLocalOrigin(configuredOrigin))) {
    return configuredOrigin;
  }

  return process.env.NODE_ENV === "production" ? productionOrigin : "http://localhost:3000";
}

export function getOAuthRedirectUri(request: Request, callbackPath: string) {
  return `${getAppOriginFromRequest(request)}${callbackPath}`;
}

function isLocalOrigin(origin: string) {
  try {
    return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.)/i.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}
