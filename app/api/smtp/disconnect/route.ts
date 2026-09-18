import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { deleteSmtpConnection } from "@/lib/smtp-connections";

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

    await deleteSmtpConnection(merchant);

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Déconnexion SMTP impossible."
      },
      { status: 500 }
    );
  }
}
