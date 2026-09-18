import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { saveSmtpConnection } from "@/lib/smtp-connections";
import { verifySmtpCredentials } from "@/lib/smtp-messages";

export const dynamic = "force-dynamic";

type ConnectBody = {
  provider?: string;
  email_address?: string;
  from_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_username?: string;
  smtp_password?: string;
};

export async function POST(request: Request) {
  try {
    const merchant = await getMerchant();

    if (!merchant) {
      return NextResponse.json(
        { error: "Commerce introuvable." },
        { status: 401 }
      );
    }

    const body = await request.json() as ConnectBody;

    const provider =
      body.provider?.trim().toLowerCase() || "custom";

    const emailAddress =
      body.email_address?.trim().toLowerCase() || "";

    const fromName =
      body.from_name?.trim() || null;

    const smtpHost =
      body.smtp_host?.trim() || "";

    const smtpPort =
      Number(body.smtp_port);

    const smtpSecure =
      Boolean(body.smtp_secure);

    const smtpUsername =
      body.smtp_username?.trim() || "";

    const smtpPassword =
      body.smtp_password || "";

    if (
      !emailAddress ||
      !smtpHost ||
      !smtpUsername ||
      !smtpPassword ||
      !Number.isInteger(smtpPort) ||
      smtpPort < 1 ||
      smtpPort > 65535
    ) {
      return NextResponse.json(
        {
          error:
            "Configuration SMTP incomplète ou invalide."
        },
        { status: 400 }
      );
    }

    /*
     * IMPORTANT :
     * on vérifie les identifiants AVANT de les sauvegarder.
     */
    try {
      await verifySmtpCredentials({
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: smtpSecure,
        smtp_username: smtpUsername,
        smtp_password: smtpPassword
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Connexion SMTP impossible.";

      return NextResponse.json(
        {
          error:
            "Impossible de se connecter au serveur SMTP. Vérifiez l’adresse, le mot de passe et les paramètres du serveur.",
          detail:
            process.env.NODE_ENV === "development"
              ? detail
              : undefined
        },
        { status: 400 }
      );
    }

    /*
     * Seulement après validation :
     * saveSmtpConnection() chiffre le mot de passe
     * avec SMTP_ENCRYPTION_KEY avant Supabase.
     */
    await saveSmtpConnection(
      {
        provider,
        email_address: emailAddress,
        from_name: fromName,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: smtpSecure,
        smtp_username: smtpUsername,
        smtp_password: smtpPassword
      },
      merchant
    );

    return NextResponse.json({
      ok: true,
      message: "Adresse e-mail connectée."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Connexion SMTP impossible."
      },
      { status: 500 }
    );
  }
}
