import { NextResponse } from "next/server";
import { getGmailConnection, isGmailConnectionReady } from "@/lib/gmail-connections";
import { getMerchant } from "@/lib/merchants";

export async function GET() {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  const connection = await getGmailConnection(merchant);
  return NextResponse.json({
    status: connection?.status ?? "disconnected",
    connected: isGmailConnectionReady(connection),
    address: connection?.gmail_address ?? null,
    connectedAt: connection?.connected_at ?? null,
    lastCheckedAt: connection?.last_checked_at ?? null,
    error: connection?.last_error ?? null
  });
}
