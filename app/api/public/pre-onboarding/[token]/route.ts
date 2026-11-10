import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getCrmGmailConnection, getFreshCrmGmailAccessToken, isCrmGmailReady } from "@/lib/crm/gmail";
import { isValidEmail, normalizeInstagramHandle, PRE_ONBOARDING_PUBLIC_TOKEN } from "@/lib/crm/pre-onboarding";
import { sendGmailMessage } from "@/lib/gmail-messages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== PRE_ONBOARDING_PUBLIC_TOKEN) return NextResponse.json({ error: "Formulaire introuvable." }, { status: 404 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (!allowRequest(ip)) return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.website) return NextResponse.json({ error: "Envoi refusé." }, { status: 400 });
  const startedAt = Number(body.startedAt);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < 1_500 || Date.now() - startedAt > 7_200_000) {
    return NextResponse.json({ error: "La session du formulaire a expiré. Rechargez la page." }, { status: 400 });
  }

  const businessName = text(body.businessName, 150);
  const managerName = text(body.managerName, 150);
  const contactEmail = email(body.contactEmail);
  const googleBusinessEmail = email(body.googleBusinessEmail);
  const gmailEmail = email(body.gmailEmail);
  const instagramBusinessName = text(body.instagramBusinessName, 150);
  const instagramHandle = normalizeInstagramHandle(text(body.instagramHandle, 100));
  const idempotencyKey = text(body.idempotencyKey, 36);
  const confirmations = body.googleBusinessConfirmed === true && body.gmailConfirmed === true && body.instagramProfessionalConfirmed === true && body.globalConfirmed === true;

  if (!businessName || !managerName || !contactEmail || !googleBusinessEmail || !gmailEmail || !instagramBusinessName || !instagramHandle || !confirmations || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: "Vérifiez les informations et les confirmations obligatoires." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const db = admin as any;
  const duplicate = await db.from("crm_pre_onboardings").select("id,lead_id").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (duplicate.data) return NextResponse.json({ ok: true, leadId: duplicate.data.lead_id });
  if (duplicate.error && duplicate.error.code !== "PGRST116") return databaseError(duplicate.error);

  const safeEmailPattern = contactEmail.replace(/[\\%_]/g, "\\$&");
  const existing = await db.from("crm_leads").select("id,deleted_at,archived_at").ilike("email", safeEmailPattern).order("created_at").limit(1).maybeSingle();
  if (existing.error) return databaseError(existing.error);
  let leadId = existing.data?.id as string | undefined;

  if (leadId) {
    const restore = await db.from("crm_leads").update({ name: businessName, email: contactEmail, email_source: "manual", deleted_at: null, archived_at: null }).eq("id", leadId);
    if (restore.error) return databaseError(restore.error);
  } else {
    const created = await db.from("crm_leads").insert({ name: businessName, email: contactEmail, email_source: "manual", lead_source: "Inscription site", commercial_status: "Nouveau" }).select("id").single();
    if (created.error || !created.data) return databaseError(created.error);
    leadId = created.data.id;
  }

  const inserted = await db.from("crm_pre_onboardings").insert({
    lead_id: leadId,
    business_name: businessName,
    manager_name: managerName,
    contact_email: contactEmail,
    google_business_email: googleBusinessEmail,
    google_business_confirmed: true,
    gmail_email: gmailEmail,
    gmail_same_as_google: body.gmailSameAsGoogle === true,
    gmail_confirmed: true,
    instagram_business_name: instagramBusinessName,
    instagram_handle: instagramHandle,
    instagram_professional_confirmed: true,
    global_confirmed: true,
    status: "À configurer",
    idempotency_key: idempotencyKey
  }).select("id").single();
  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === "23505") return NextResponse.json({ ok: true, leadId });
    return databaseError(inserted.error);
  }

  const origin = getAppOriginFromRequest(request);
  const crmUrl = `${origin}/crm/leads/${leadId}`;
  let notificationStatus: "sent" | "failed" | "skipped" = "skipped";
  let notificationError: string | null = null;
  try {
    const connection = await getCrmGmailConnection(admin);
    if (isCrmGmailReady(connection)) {
      const accessToken = await getFreshCrmGmailAccessToken(connection!, admin);
      await sendGmailMessage({
        accessToken,
        fromEmail: connection!.gmail_address!,
        fromName: "AtriumOne CRM",
        to: process.env.PRE_ONBOARDING_NOTIFICATION_EMAIL?.trim() || "louisdacre@gmail.com",
        subject: `Nouveau pré-onboarding · ${businessName}`,
        html: notificationHtml({ businessName, managerName, contactEmail, crmUrl }),
        campaignId: `pre-onboarding:${inserted.data.id}`
      });
      notificationStatus = "sent";
    } else {
      notificationError = "Gmail CRM non connecté.";
    }
  } catch (caught) {
    notificationStatus = "failed";
    notificationError = caught instanceof Error ? caught.message.slice(0, 1000) : "Envoi impossible.";
    console.error("[pre-onboarding] notification_failed", { submissionId: inserted.data.id, message: notificationError });
  }
  await db.from("crm_pre_onboardings").update({ notification_status: notificationStatus, notification_error: notificationError }).eq("id", inserted.data.id);

  return NextResponse.json({ ok: true, leadId });
}

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function email(value: unknown) { const result = text(value, 254).toLowerCase(); return isValidEmail(result) ? result : ""; }
function databaseError(error: any) {
  console.error("[pre-onboarding] database_error", { code: error?.code ?? "unknown", message: error?.message ?? "unknown" });
  return NextResponse.json({ error: "Le formulaire n’a pas pu être enregistré. Réessayez dans quelques instants." }, { status: 500 });
}
function allowRequest(ip: string) {
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || current.resetAt <= now) { buckets.set(ip, { count: 1, resetAt: now + 3_600_000 }); return true; }
  if (current.count >= 8) return false;
  current.count += 1;
  if (buckets.size > 500) for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  return true;
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!); }
function notificationHtml({ businessName, managerName, contactEmail, crmUrl }: { businessName: string; managerName: string; contactEmail: string; crmUrl: string }) {
  return `<div style="font-family:Arial,sans-serif;color:#211432;line-height:1.6"><h1 style="font-size:22px">Nouveau pré-onboarding AtriumOne</h1><p><strong>${escapeHtml(businessName)}</strong> vient de remplir le formulaire.</p><p>Responsable : ${escapeHtml(managerName)}<br>E-mail : ${escapeHtml(contactEmail)}</p><p><a href="${escapeHtml(crmUrl)}" style="display:inline-block;background:#4c1d95;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Ouvrir la fiche client dans le CRM</a></p></div>`;
}
