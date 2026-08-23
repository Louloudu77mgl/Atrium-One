type GmailSendResponse = {
  id?: string;
  threadId?: string;
  error?: { message?: string; status?: string };
};

export async function sendGmailMessage({
  accessToken,
  fromEmail,
  fromName,
  to,
  subject,
  html,
  unsubscribeUrl,
  campaignId
}: {
  accessToken: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
  campaignId?: string;
}) {
  const raw = createRawMessage({ fromEmail, fromName, to, subject, html, unsubscribeUrl, campaignId });
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const data = await response.json() as GmailSendResponse;

  if (!response.ok || !data.id) {
    console.error("[gmail/send] provider_rejected", {
      status: response.status,
      providerStatus: data.error?.status ?? null,
      providerMessage: data.error?.message ?? null
    });
    if (response.status === 401) throw new Error("Votre connexion Gmail doit être renouvelée.");
    if (response.status === 403) throw new Error("Gmail n’autorise pas encore AtriumOne à envoyer depuis ce compte.");
    if (response.status === 429) throw new Error("Gmail limite temporairement les envois. Réessayez un peu plus tard.");
    throw new Error("Gmail n’a pas pu envoyer cet e-mail.");
  }

  return data.id;
}

function createRawMessage({
  fromEmail,
  fromName,
  to,
  subject,
  html,
  unsubscribeUrl,
  campaignId
}: {
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
  campaignId?: string;
}) {
  const safeFromEmail = sanitizeHeader(fromEmail);
  const safeTo = sanitizeHeader(to);
  const safeName = encodeHeader(fromName);
  const headers = [
    `From: ${safeName} <${safeFromEmail}>`,
    `Reply-To: ${safeFromEmail}`,
    `To: ${safeTo}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64"
  ];
  if (unsubscribeUrl) {
    headers.push(`List-Unsubscribe: <${sanitizeHeader(unsubscribeUrl)}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }
  if (campaignId) headers.push(`X-AtriumOne-Campaign: ${sanitizeHeader(campaignId)}`);
  const body = wrapBase64(Buffer.from(html, "utf8").toString("base64"));
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(sanitizeHeader(value), "utf8").toString("base64")}?=`;
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? value;
}
