import { NextResponse } from "next/server";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";
import { isCrmAdminEmail } from "@/lib/crm/access";
export { findDuplicate, normalizeDomain, normalizeNameAddress, normalizePhone } from "@/lib/crm/logic";

export class CrmApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export async function getCrmContext() {
  const user = await getCurrentUser();
  if (!user) throw new CrmApiError(401, "UNAUTHENTICATED", "Connexion requise.");
  if (!isCrmAdminEmail(user.email)) throw new CrmApiError(403, "CRM_FORBIDDEN", "Accès CRM refusé.");
  const supabase = await createServerSupabaseClient();
  return { user, supabase: supabase as any };
}

export function crmErrorResponse(error: unknown) {
  if (error instanceof CrmApiError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error("CRM request failed", error instanceof Error ? error.message : "unknown_error");
  return NextResponse.json({ error: { code: "CRM_ERROR", message: "L’action CRM n’a pas pu aboutir." } }, { status: 500 });
}

export function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}
