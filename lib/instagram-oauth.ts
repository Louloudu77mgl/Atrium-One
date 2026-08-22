import { cookies } from "next/headers";

export const instagramOAuthStateCookie = "atrium_instagram_oauth_state";

export function getInstagramOAuthConfig() {
  const clientId = process.env.INSTAGRAM_APP_ID ?? process.env.META_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET ?? process.env.META_CLIENT_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ?? process.env.META_REDIRECT_URI;
  const apiVersion = process.env.INSTAGRAM_GRAPH_API_VERSION ?? "v23.0";

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Configuration Instagram non disponible.");
  }

  if (!/^\d+$/.test(clientId)) {
    throw new Error("L’identifiant de l’application Instagram est invalide.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    apiVersion
  };
}

export async function setInstagramOAuthState(state: string) {
  const cookieStore = await cookies();

  cookieStore.set(instagramOAuthStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });
}

export async function consumeInstagramOAuthState() {
  const cookieStore = await cookies();
  const state = cookieStore.get(instagramOAuthStateCookie)?.value;

  cookieStore.delete(instagramOAuthStateCookie);

  return state;
}

export function hasInstagramOAuthConfig() {
  return Boolean(
    (process.env.INSTAGRAM_APP_ID ?? process.env.META_CLIENT_ID) &&
      (process.env.INSTAGRAM_APP_SECRET ?? process.env.META_CLIENT_SECRET) &&
      (process.env.INSTAGRAM_REDIRECT_URI ?? process.env.META_REDIRECT_URI)
  );
}
