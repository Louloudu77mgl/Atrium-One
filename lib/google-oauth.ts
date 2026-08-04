import { cookies } from "next/headers";

export const googleBusinessScope = "openid email https://www.googleapis.com/auth/business.manage";
export const googleOAuthStateCookie = "atrium_google_oauth_state";
export const googleAccessTokenCookie = "atrium_google_access_token";
export const googleRefreshTokenCookie = "atrium_google_refresh_token";
export const googleAccountEmailCookie = "atrium_google_account_email";

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Configuration Google OAuth manquante.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri
  };
}

export async function setGoogleOAuthState(state: string) {
  const cookieStore = await cookies();

  cookieStore.set(googleOAuthStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });
}

export async function consumeGoogleOAuthState() {
  const cookieStore = await cookies();
  const state = cookieStore.get(googleOAuthStateCookie)?.value;

  cookieStore.delete(googleOAuthStateCookie);

  return state;
}

export async function setTemporaryGoogleTokens({
  accessToken,
  refreshToken,
  email
}: {
  accessToken: string;
  refreshToken?: string | null;
  email?: string | null;
}) {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60
  };

  cookieStore.set(googleAccessTokenCookie, accessToken, options);

  if (refreshToken) {
    cookieStore.set(googleRefreshTokenCookie, refreshToken, options);
  }

  if (email) {
    cookieStore.set(googleAccountEmailCookie, email, options);
  }
}

export async function getTemporaryGoogleTokens() {
  const cookieStore = await cookies();

  return {
    accessToken: cookieStore.get(googleAccessTokenCookie)?.value ?? null,
    refreshToken: cookieStore.get(googleRefreshTokenCookie)?.value ?? null,
    email: cookieStore.get(googleAccountEmailCookie)?.value ?? null
  };
}

export async function clearTemporaryGoogleTokens() {
  const cookieStore = await cookies();

  cookieStore.delete(googleAccessTokenCookie);
  cookieStore.delete(googleRefreshTokenCookie);
  cookieStore.delete(googleAccountEmailCookie);
}
