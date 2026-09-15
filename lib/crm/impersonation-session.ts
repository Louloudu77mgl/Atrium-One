import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_IMPERSONATION_COOKIE } from "@/lib/crm/impersonation-constants";

export type AdminImpersonationSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  businessId: string;
  businessName: string;
  leadId: string;
  userId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function encryptionKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createHash("sha256").update(`atriumone-admin-impersonation:${secret}`).digest();
}

function isValidSession(value: unknown): value is AdminImpersonationSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<AdminImpersonationSession>;
  return typeof session.accessToken === "string"
    && session.accessToken.length > 20
    && typeof session.refreshToken === "string"
    && session.refreshToken.length > 5
    && typeof session.expiresAt === "number"
    && Number.isFinite(session.expiresAt)
    && typeof session.businessId === "string"
    && UUID_PATTERN.test(session.businessId)
    && typeof session.leadId === "string"
    && UUID_PATTERN.test(session.leadId)
    && typeof session.userId === "string"
    && UUID_PATTERN.test(session.userId)
    && typeof session.businessName === "string"
    && session.businessName.length > 0
    && session.businessName.length <= 200;
}

export function sealAdminImpersonationSession(session: AdminImpersonationSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function unsealAdminImpersonationSession(value?: string | null): AdminImpersonationSession | null {
  if (!value) return null;
  try {
    const [version, encodedIv, encodedTag, encodedPayload] = value.split(".");
    if (version !== "v1" || !encodedIv || !encodedTag || !encodedPayload) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encodedPayload, "base64url")), decipher.final()]);
    const session = JSON.parse(decrypted.toString("utf8")) as unknown;
    return isValidSession(session) ? session : null;
  } catch {
    return null;
  }
}

export async function getAdminImpersonationSession() {
  const cookieStore = await cookies();
  return unsealAdminImpersonationSession(cookieStore.get(ADMIN_IMPERSONATION_COOKIE)?.value);
}
