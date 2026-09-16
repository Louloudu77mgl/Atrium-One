import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConfiguredAppOrigin } from "@/lib/app-origin";
import { gmailOAuthScopes, gmailSendScope } from "@/lib/gmail-oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CrmGmailConnectionRow, Database } from "@/lib/supabase/types";

const stateCookie = "atrium_crm_gmail_oauth_state";

function crmTokenKey() {
  const secret = process.env.CRM_TOKEN_ENCRYPTION_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Clé de chiffrement Gmail CRM manquante.");
  return createHash("sha256").update(secret).digest();
}

function encryptToken(value: string | null) {
  if (!value) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", crmTokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptToken(value: string | null) {
  if (!value || !value.startsWith("v1.")) return value;
  try {
    const [, encodedIv, encodedTag, encodedPayload] = value.split(".");
    const decipher = createDecipheriv("aes-256-gcm", crmTokenKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encodedPayload, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("La connexion Gmail AtriumOne doit être renouvelée.");
  }
}

export function getCrmGmailOAuthConfig() {
  const clientId = process.env.CRM_GMAIL_CLIENT_ID?.trim() || process.env.GMAIL_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.CRM_GMAIL_CLIENT_SECRET?.trim() || process.env.GMAIL_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.CRM_GMAIL_REDIRECT_URI?.trim() || `${getConfiguredAppOrigin()}/api/crm/gmail/callback`;
  if (!clientId || !clientSecret) throw new Error("Configuration Gmail CRM manquante.");
  return { clientId, clientSecret, redirectUri, scopes: gmailOAuthScopes, sendScope: gmailSendScope };
}

export async function setCrmGmailState(state: string) {
  const store = await cookies();
  store.set(stateCookie, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
}

export async function consumeCrmGmailState() {
  const store = await cookies();
  const value = store.get(stateCookie)?.value ?? null;
  store.delete(stateCookie);
  return value;
}

export async function getCrmGmailConnection(client?: SupabaseClient<Database>) {
  const supabase = client ?? createSupabaseAdminClient();
  const { data, error } = await supabase.from("crm_gmail_connections").select("*").eq("id", "atriumone").maybeSingle();
  if (error) {
    if (error.message.includes("schema cache") || error.message.includes("Could not find")) return null;
    throw new Error(error.message);
  }
  return data ? {
    ...data,
    access_token_encrypted: decryptToken(data.access_token_encrypted),
    refresh_token_encrypted: decryptToken(data.refresh_token_encrypted)
  } : null;
}

export async function upsertCrmGmailConnection(payload: Partial<CrmGmailConnectionRow>, client?: SupabaseClient<Database>) {
  const supabase = client ?? createSupabaseAdminClient();
  const protectedPayload = {
    ...payload,
    ...(payload.access_token_encrypted !== undefined ? { access_token_encrypted: encryptToken(payload.access_token_encrypted) } : {}),
    ...(payload.refresh_token_encrypted !== undefined ? { refresh_token_encrypted: encryptToken(payload.refresh_token_encrypted) } : {})
  };
  const { data, error } = await supabase.from("crm_gmail_connections").upsert({ id: "atriumone", ...protectedPayload, updated_at: new Date().toISOString() }).select("*").single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    access_token_encrypted: decryptToken(data.access_token_encrypted),
    refresh_token_encrypted: decryptToken(data.refresh_token_encrypted)
  };
}

export function isCrmGmailReady(connection?: CrmGmailConnectionRow | null) {
  return Boolean(connection?.status === "connected" && connection.gmail_address && (connection.access_token_encrypted || connection.refresh_token_encrypted));
}

export async function getFreshCrmGmailAccessToken(connection: CrmGmailConnectionRow, client?: SupabaseClient<Database>) {
  const expiresAt = connection.token_expires_at ? Date.parse(connection.token_expires_at) : 0;
  if (connection.access_token_encrypted && expiresAt > Date.now() + 60_000) return connection.access_token_encrypted;
  if (!connection.refresh_token_encrypted) throw new Error("La connexion Gmail AtriumOne doit être renouvelée.");
  const config = getCrmGmailOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: connection.refresh_token_encrypted, grant_type: "refresh_token" }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token) {
    await upsertCrmGmailConnection({ status: "error", last_error: "La connexion Gmail AtriumOne doit être renouvelée.", last_checked_at: new Date().toISOString() }, client).catch(() => null);
    throw new Error("La connexion Gmail AtriumOne doit être renouvelée.");
  }
  const now = new Date();
  await upsertCrmGmailConnection({ access_token_encrypted: data.access_token, token_expires_at: new Date(now.getTime() + Math.max(60, data.expires_in ?? 3600) * 1000).toISOString(), status: "connected", last_error: null, last_checked_at: now.toISOString() }, client);
  return data.access_token;
}
