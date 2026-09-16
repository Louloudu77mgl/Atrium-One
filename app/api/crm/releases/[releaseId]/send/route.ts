import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { getCrmGmailConnection, getFreshCrmGmailAccessToken, isCrmGmailReady } from "@/lib/crm/gmail";
import { renderAtriumOneReleaseEmail } from "@/lib/crm/release-email";
import { sendGmailMessage } from "@/lib/gmail-messages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const { releaseId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ error: "Confirmation requise." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const [{ data: release }, connection, audienceResult] = await Promise.all([
    admin.from("crm_releases").select("*").eq("id", releaseId).maybeSingle(),
    getCrmGmailConnection(admin),
    admin.rpc("crm_active_release_audience")
  ]);
  if (!release) return NextResponse.json({ error: "Release introuvable." }, { status: 404 });
  if (!isCrmGmailReady(connection)) return NextResponse.json({ error: "Connectez le Gmail administrateur AtriumOne avant l’envoi." }, { status: 409 });
  if (audienceResult.error) return NextResponse.json({ error: audienceResult.error.message }, { status: 500 });
  const audience = audienceResult.data ?? [];
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim().slice(0, 180) : release.email_subject || `Nouveautés AtriumOne · ${release.title}`;
  const intro = typeof body.intro === "string" ? body.intro.trim().slice(0, 1000) : null;
  const contentHash = createHash("sha256").update(JSON.stringify({
    title: release.title,
    releaseDate: release.release_date,
    version: release.version,
    summary: release.summary,
    description: release.description,
    highlights: release.highlights,
    improvements: release.improvements,
    fixes: release.fixes,
    category: release.category,
    emailIntro: release.email_intro,
    subject,
    intro: intro ?? ""
  })).digest("hex").slice(0, 24);
  const idempotencyKey = `release:${release.id}:${contentHash}`;
  let { data: send, error: lookupError } = await admin.from("crm_release_sends").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!send) {
    if (!audience.length) return NextResponse.json({ error: "Aucun utilisateur actif à contacter." }, { status: 409 });
    const inserted = await admin.from("crm_release_sends").insert({ release_id: release.id, idempotency_key: idempotencyKey, audience_count: audience.length, created_by: user.id }).select("*").single();
    send = inserted.data;
    if (inserted.error?.code === "23505") {
      const existing = await admin.from("crm_release_sends").select("*").eq("idempotency_key", idempotencyKey).single();
      send = existing.data;
      lookupError = existing.error;
    } else {
      lookupError = inserted.error;
    }
  }
  if (lookupError || !send) return NextResponse.json({ error: lookupError?.message ?? "Envoi impossible." }, { status: 500 });
  if (send.status === "sent") return NextResponse.json({ error: "Cette version de la release a déjà été envoyée.", send }, { status: 409 });
  if (send.status === "sending") return NextResponse.json({ error: "Cet envoi est déjà en cours.", send }, { status: 409 });
  const now = new Date().toISOString();
  const { data: claimed } = await admin.from("crm_release_sends").update({ status: "sending", started_at: now, error_message: null, updated_at: now }).eq("id", send.id).in("status", ["pending", "failed", "partial"]).select("*").maybeSingle();
  if (!claimed) return NextResponse.json({ error: "Cet envoi est déjà pris en charge." }, { status: 409 });
  const snapshot = await admin.from("crm_release_recipients").select("id", { count: "exact", head: true }).eq("send_id", send.id);
  if (snapshot.error) {
    await markSendFailed(admin, send.id, snapshot.error.message);
    return NextResponse.json({ error: snapshot.error.message }, { status: 500 });
  }
  if ((snapshot.count ?? 0) === 0) {
    if (!audience.length) {
      const message = "Aucun utilisateur actif à contacter.";
      await markSendFailed(admin, send.id, message);
      return NextResponse.json({ error: message }, { status: 409 });
    }
    const seeded = await admin.from("crm_release_recipients").upsert(audience.map((recipient) => ({ send_id: send!.id, release_id: release.id, merchant_id: recipient.merchant_id, email: recipient.email, business_name: recipient.business_name })), { onConflict: "send_id,email", ignoreDuplicates: true });
    if (seeded.error) {
      await markSendFailed(admin, send.id, seeded.error.message);
      return NextResponse.json({ error: seeded.error.message }, { status: 500 });
    }
  }
  const { data: recipients, error: recipientsError } = await admin.from("crm_release_recipients").select("*").eq("send_id", send.id).in("status", ["pending", "failed"]).order("created_at");
  if (recipientsError) {
    await markSendFailed(admin, send.id, recipientsError.message);
    return NextResponse.json({ error: recipientsError.message }, { status: 500 });
  }
  let accessToken: string;
  let html: string;
  try {
    accessToken = await getFreshCrmGmailAccessToken(connection!, admin);
    html = renderAtriumOneReleaseEmail({ release, origin: getAppOriginFromRequest(request), introOverride: intro });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Préparation de l’envoi impossible.";
    await markSendFailed(admin, send.id, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  for (let index = 0; index < (recipients ?? []).length; index += 5) {
    await Promise.all((recipients ?? []).slice(index, index + 5).map(async (recipient) => {
      const { data: recipientClaim } = await admin.from("crm_release_recipients").update({ status: "sending", error_message: null, updated_at: new Date().toISOString() }).eq("id", recipient.id).in("status", ["pending", "failed"]).select("id").maybeSingle();
      if (!recipientClaim) return;
      try {
        const messageId = await sendGmailMessage({ accessToken, fromEmail: connection!.gmail_address!, fromName: "AtriumOne", to: recipient.email, subject, html, campaignId: `release:${release.id}:${send!.id}` });
        await admin.from("crm_release_recipients").update({ status: "sent", gmail_message_id: messageId, sent_at: new Date().toISOString(), error_message: null, updated_at: new Date().toISOString() }).eq("id", recipient.id).eq("status", "sending");
      } catch (error) {
        await admin.from("crm_release_recipients").update({ status: "failed", error_message: (error instanceof Error ? error.message : "Envoi impossible.").slice(0, 1000), updated_at: new Date().toISOString() }).eq("id", recipient.id).eq("status", "sending");
      }
    }));
  }
  const { data: finalRecipients } = await admin.from("crm_release_recipients").select("status").eq("send_id", send.id);
  const sentCount = (finalRecipients ?? []).filter((recipient) => recipient.status === "sent").length;
  const failedCount = (finalRecipients ?? []).filter((recipient) => recipient.status === "failed").length;
  const audienceCount = finalRecipients?.length ?? claimed.audience_count;
  const finalStatus = failedCount === 0 && sentCount === audienceCount ? "sent" : sentCount > 0 ? "partial" : "failed";
  const completedAt = new Date().toISOString();
  const { data: completed } = await admin.from("crm_release_sends").update({ status: finalStatus, sent_count: sentCount, failed_count: failedCount, completed_at: completedAt, error_message: failedCount ? `${failedCount} destinataire(s) en échec.` : null, updated_at: completedAt }).eq("id", send.id).select("*").single();
  if (sentCount > 0) await admin.from("crm_releases").update({ status: "published", published_at: release.published_at ?? completedAt, sent_at: completedAt, updated_at: completedAt }).eq("id", release.id);
  return NextResponse.json({ send: completed, sentCount, failedCount, audienceCount });
}

async function markSendFailed(admin: ReturnType<typeof createSupabaseAdminClient>, sendId: string, message: string) {
  const now = new Date().toISOString();
  await admin.from("crm_release_sends").update({ status: "failed", error_message: message.slice(0, 1000), completed_at: now, updated_at: now }).eq("id", sendId).eq("status", "sending");
}
