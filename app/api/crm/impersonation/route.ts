import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_IMPERSONATION_COOKIE, ADMIN_IMPERSONATION_MAX_AGE_SECONDS } from "@/lib/crm/impersonation-constants";
import { sealAdminImpersonationSession } from "@/lib/crm/impersonation-session";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const adminUser = await getCurrentUser();
  if (!adminUser || !isCrmAdminEmail(adminUser.email)) return jsonError("Accès CRM refusé.", 403);
  if (!hasSupabaseAdminEnv()) return jsonError("La configuration administrateur Supabase est manquante.", 500);

  const body = await request.json().catch(() => null) as { businessId?: string; leadId?: string } | null;
  if (!body?.businessId || !UUID_PATTERN.test(body.businessId) || !body.leadId || !UUID_PATTERN.test(body.leadId)) {
    return jsonError("Compte AtriumOne invalide.", 400);
  }

  const admin = createSupabaseAdminClient() as any;
  const [{ data: lead, error: leadError }, { data: merchant, error: merchantError }] = await Promise.all([
    admin.from("crm_leads").select("id,business_id").eq("id", body.leadId).is("deleted_at", null).maybeSingle(),
    admin.from("merchants").select("id,user_id,business_name").eq("id", body.businessId).maybeSingle()
  ]);

  if (leadError || merchantError) return jsonError("Le compte du commerce n’a pas pu être vérifié.", 500);
  if (!lead || !merchant || lead.business_id !== merchant.id) return jsonError("Ce compte n’est pas associé à cette fiche client.", 404);

  const { data: accountData, error: accountError } = await admin.auth.admin.getUserById(merchant.user_id);
  const account = accountData.user;
  if (accountError || !account?.email) return jsonError("Le compte de connexion du commerce est introuvable.", 404);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: account.email });
  if (linkError || !linkData.properties || linkData.user.id !== merchant.user_id) {
    return jsonError("La session temporaire du commerce n’a pas pu être créée.", 500);
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const merchantAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  });
  const { data: verified, error: verificationError } = await merchantAuth.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink"
  });

  if (verificationError || !verified.session || verified.user?.id !== merchant.user_id) {
    return jsonError("La session temporaire du commerce n’a pas pu être activée.", 500);
  }

  const cookieValue = sealAdminImpersonationSession({
    accessToken: verified.session.access_token,
    refreshToken: verified.session.refresh_token,
    expiresAt: verified.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    businessId: merchant.id,
    businessName: merchant.business_name.slice(0, 200),
    leadId: lead.id,
    userId: merchant.user_id
  });
  const response = NextResponse.json({ url: "/dashboard" }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_IMPERSONATION_COOKIE, cookieValue, {
    httpOnly: true,
    maxAge: ADMIN_IMPERSONATION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

export async function DELETE() {
  const adminUser = await getCurrentUser();
  const response = NextResponse.json({
    url: adminUser && isCrmAdminEmail(adminUser.email) ? "/crm" : "/login"
  }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_IMPERSONATION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}
