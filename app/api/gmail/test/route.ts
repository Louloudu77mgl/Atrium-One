import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getGmailConnection, isGmailConnectionReady, upsertGmailConnection } from "@/lib/gmail-connections";
import { sendGmailMessage } from "@/lib/gmail-messages";
import { getFreshGmailAccessToken } from "@/lib/gmail-tokens";
import { getMerchant } from "@/lib/merchants";
import type { EmailCampaignContent } from "@/lib/emailing-types";

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  const connection = await getGmailConnection(merchant);
  if (!isGmailConnectionReady(connection) || !connection?.gmail_address) {
    return NextResponse.json({ error: "Connectez Gmail avant d’envoyer un test." }, { status: 409 });
  }

  try {
    const payload = await request.json().catch(() => null) as { content?: Partial<EmailCampaignContent> } | null;
    const preview = payload?.content;
    const accessToken = await getFreshGmailAccessToken(connection, merchant);
    await sendGmailMessage({
      accessToken,
      fromEmail: connection.gmail_address,
      fromName: merchant.business_name,
      to: connection.gmail_address,
      subject: cleanText(preview?.subject, "Votre connexion Gmail AtriumOne fonctionne", 120),
      html: preview ? renderCampaignPreview(preview, merchant.business_name) : renderConnectionTest(connection.gmail_address)
    });
    const now = new Date().toISOString();
    await upsertGmailConnection({ merchant_id: merchant.id, status: "connected", last_checked_at: now, last_error: null }, merchant);
    revalidatePath("/emailing");
    revalidatePath("/integrations");
    return NextResponse.json({ ok: true, message: `E-mail test envoyé à ${connection.gmail_address}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d’envoyer l’e-mail test.";
    await upsertGmailConnection({ merchant_id: merchant.id, last_error: message, last_checked_at: new Date().toISOString() }, merchant).catch(() => null);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function renderConnectionTest(address: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;padding:32px;border:1px solid #e9d5ff;border-radius:20px"><h1 style="color:#4c1d95">Connexion réussie</h1><p>AtriumOne peut maintenant envoyer vos campagnes depuis <strong>${escapeHtml(address)}</strong>.</p><p>Vous pouvez revenir dans l’espace E-mailing pour préparer votre première campagne.</p></div>`;
}

function renderCampaignPreview(content: Partial<EmailCampaignContent>, businessName: string) {
  const heading = cleanText(content.heading, "Votre campagne AtriumOne", 180);
  const body = cleanText(content.body, "Voici un aperçu de votre campagne.", 6000)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.65">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
  const signature = cleanText(content.signature, businessName, 600);
  const primaryColor = /^#[0-9a-f]{6}$/i.test(String(content.primaryColor ?? "")) ? content.primaryColor : "#4C1D95";

  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:40px auto;border:1px solid #e9d5ff;border-radius:24px;overflow:hidden"><div style="padding:32px"><div style="margin-bottom:12px;font-size:12px;font-weight:700;color:#7c3aed">APERÇU ATRIUMONE</div><h1 style="margin:0 0 24px;color:${primaryColor};font-size:30px">${escapeHtml(heading)}</h1>${body}<p style="margin:24px 0 0;font-weight:700;color:#6b617f">${escapeHtml(signature).replaceAll("\n", "<br>")}</p></div></div>`;
}

function cleanText(value: unknown, fallback: string, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum) || fallback;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
