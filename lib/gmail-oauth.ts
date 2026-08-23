import { cookies } from "next/headers";
import { getConfiguredAppOrigin } from "@/lib/app-origin";

export const gmailSendScope = "https://www.googleapis.com/auth/gmail.send";
export const gmailOAuthScopes = `openid email profile ${gmailSendScope}`;
export const gmailOAuthStateCookie = "atrium_gmail_oauth_state";

export function getGmailOAuthConfig() {
  const clientId = normalizeValue(process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID);
  const clientSecret = normalizeValue(process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = normalizeValue(process.env.GMAIL_REDIRECT_URI)
    ?? `${getConfiguredAppOrigin()}/api/gmail/callback`;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Configuration Gmail manquante.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function hasGmailOAuthConfig() {
  try {
    getGmailOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

export async function setGmailOAuthState(state: string) {
  const cookieStore = await cookies();
  cookieStore.set(gmailOAuthStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });
}

export async function consumeGmailOAuthState() {
  const cookieStore = await cookies();
  const state = cookieStore.get(gmailOAuthStateCookie)?.value ?? null;
  cookieStore.delete(gmailOAuthStateCookie);
  return state;
}

function normalizeValue(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const quoted = (normalized.startsWith('"') && normalized.endsWith('"'))
    || (normalized.startsWith("'") && normalized.endsWith("'"));
  return quoted ? normalized.slice(1, -1).trim() : normalized;
}
