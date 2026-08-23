import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getGmailConnection, isGmailConnectionReady, upsertGmailConnection } from "@/lib/gmail-connections";
import { sendGmailMessage } from "@/lib/gmail-messages";
import { getFreshGmailAccessToken } from "@/lib/gmail-tokens";
import { getMerchant } from "@/lib/merchants";

export async function POST() {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  const connection = await getGmailConnection(merchant);
  if (!isGmailConnectionReady(connection) || !connection?.gmail_address) {
    return NextResponse.json({ error: "Connectez Gmail avant d’envoyer un test." }, { status: 409 });
  }

  try {
    const accessToken = await getFreshGmailAccessToken(connection, merchant);
    await sendGmailMessage({
      accessToken,
      fromEmail: connection.gmail_address,
      fromName: merchant.business_name,
      to: connection.gmail_address,
      subject: "Votre connexion Gmail AtriumOne fonctionne",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;padding:32px;border:1px solid #e9d5ff;border-radius:20px"><h1 style="color:#4c1d95">Connexion réussie</h1><p>AtriumOne peut maintenant envoyer vos campagnes depuis <strong>${escapeHtml(connection.gmail_address)}</strong>.</p><p>Vous pouvez revenir dans l’espace E-mailing pour préparer votre première campagne.</p></div>`
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
