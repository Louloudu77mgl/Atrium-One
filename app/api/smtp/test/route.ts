import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import {
  getSmtpConnection,
  updateSmtpConnectionStatus
} from "@/lib/smtp-connections";
import {
  isSmtpConnectionReady
} from "@/lib/smtp-connections";
import { verifySmtpConnection } from "@/lib/smtp-messages";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const merchant = await getMerchant();

    if (!merchant) {
      return NextResponse.json(
        { error: "Commerce introuvable." },
        { status: 401 }
      );
    }

    const connection = await getSmtpConnection(merchant);

    if (!connection || !isSmtpConnectionReady(connection)) {
      return NextResponse.json(
        { error: "Aucune connexion SMTP active." },
        { status: 400 }
      );
    }

    try {
      await verifySmtpConnection(connection);

      await updateSmtpConnectionStatus(
        {
          merchant_id: merchant.id,
          status: "connected",
          last_checked_at: new Date().toISOString(),
          last_error: null
        },
        merchant
      );

      return NextResponse.json({
        ok: true,
        message: "Connexion SMTP opérationnelle."
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Test SMTP impossible.";

      await updateSmtpConnectionStatus(
        {
          merchant_id: merchant.id,
          status: "error",
          last_checked_at: new Date().toISOString(),
          last_error: message
        },
        merchant
      ).catch(() => null);

      return NextResponse.json(
        {
          error:
            "La connexion au serveur SMTP a échoué. Vérifiez les identifiants."
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Test SMTP impossible."
      },
      { status: 500 }
    );
  }
}
