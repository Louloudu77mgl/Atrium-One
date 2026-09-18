import nodemailer from "nodemailer";
import { decryptSmtpPassword } from "@/lib/smtp-crypto";
import type { SmtpConnectionRow } from "@/lib/supabase/types";

export type SmtpCredentials = {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
};

function createTransport(credentials: SmtpCredentials) {
  return nodemailer.createTransport({
    host: credentials.smtp_host,
    port: credentials.smtp_port,
    secure: credentials.smtp_secure,
    auth: {
      user: credentials.smtp_username,
      pass: credentials.smtp_password
    }
  });
}

function credentialsFromConnection(
  connection: SmtpConnectionRow
): SmtpCredentials {
  return {
    smtp_host: connection.smtp_host,
    smtp_port: connection.smtp_port,
    smtp_secure: connection.smtp_secure,
    smtp_username: connection.smtp_username,
    smtp_password: decryptSmtpPassword(
      connection.smtp_password_encrypted
    )
  };
}

export async function verifySmtpCredentials(
  credentials: SmtpCredentials
) {
  const transporter = createTransport(credentials);
  await transporter.verify();
  transporter.close();

  return true;
}

export async function verifySmtpConnection(
  connection: SmtpConnectionRow
) {
  return verifySmtpCredentials(
    credentialsFromConnection(connection)
  );
}

export async function sendSmtpMessage({
  connection,
  fromName,
  to,
  subject,
  html,
  unsubscribeUrl,
  campaignId
}: {
  connection: SmtpConnectionRow;
  fromName?: string | null;
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
  campaignId?: string;
}) {
  const transporter = createTransport(
    credentialsFromConnection(connection)
  );

  try {
    const result = await transporter.sendMail({
      from: {
        name: fromName || connection.from_name || "",
        address: connection.email_address
      },
      to,
      subject,
      html,
      headers: {
        ...(unsubscribeUrl
          ? {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post":
                "List-Unsubscribe=One-Click"
            }
          : {}),
        ...(campaignId
          ? {
              "X-AtriumOne-Campaign-ID": campaignId
            }
          : {})
      }
    });

    return result.messageId;
  } finally {
    transporter.close();
  }
}
