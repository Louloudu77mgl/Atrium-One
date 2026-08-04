import { createHmac, timingSafeEqual } from "crypto";
import { validateDesignDocumentLayout } from "@/lib/social-editor/layout-safety";
import { isEditorDocument } from "@/lib/social-editor/types";
import type { MerchantRow, SocialPostRow } from "@/lib/supabase/types";

export type MakeInstagramPayload = {
  event: "instagram.publish.requested";
  event_id: string;
  idempotency_key: string;
  merchant_id: string;
  merchant_name: string;
  merchant_type: string;
  merchant_city: string;
  connection_key: string;
  post_id: string;
  image_url: string;
  caption: string;
  scheduled_at: string | null;
  callback_url: string;
  created_at: string;
};

export function hasMakeInstagramWebhookConfig() {
  return Boolean(process.env.MAKE_INSTAGRAM_WEBHOOK_URL && process.env.MAKE_INSTAGRAM_WEBHOOK_SECRET);
}

export async function dispatchInstagramPostToMake({
  merchant,
  post
}: {
  merchant: MerchantRow;
  post: SocialPostRow;
}) {
  const webhookUrl = process.env.MAKE_INSTAGRAM_WEBHOOK_URL;
  const secret = process.env.MAKE_INSTAGRAM_WEBHOOK_SECRET;

  if (!webhookUrl || !secret) {
    throw new Error("Le webhook Make Instagram n’est pas configuré.");
  }

  const imageUrl = post.visual_url;
  if (post.visual_html !== "atrium-final-png-v1" || !imageUrl || !imageUrl.startsWith("https://")) {
    throw new Error("Le visuel est encore en préparation. Réessayez la publication dans quelques instants.");
  }

  if (isEditorDocument(post.builder_state)) {
    const layoutErrors = validateDesignDocumentLayout(post.builder_state);
    if (layoutErrors.length > 0) {
      throw new Error(`Envoi vers Make bloqué pour éviter un texte tronqué : ${layoutErrors[0]}`);
    }
  }

  const hashtags = post.hashtags
    .map((tag) => tag.startsWith("#") ? tag : `#${tag}`)
    .join(" ");
  const payload: MakeInstagramPayload = {
    event: "instagram.publish.requested",
    event_id: post.id,
    idempotency_key: `instagram:${merchant.id}:${post.id}`,
    merchant_id: merchant.id,
    merchant_name: merchant.business_name,
    merchant_type: merchant.business_type,
    merchant_city: merchant.city,
    connection_key: merchant.id,
    post_id: post.id,
    image_url: imageUrl,
    caption: [post.caption, hashtags].filter(Boolean).join("\n\n"),
    scheduled_at: post.scheduled_at,
    callback_url: `${getAppOrigin()}/api/webhooks/make/instagram`,
    created_at: new Date().toISOString()
  };
  const body = JSON.stringify(payload);
  const signature = signMakeWebhookBody(body, secret);
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Atrium-Webhook-Secret": secret,
      "X-Atrium-Signature": signature,
      "X-Atrium-Event-Id": payload.event_id,
      "Idempotency-Key": payload.idempotency_key
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Make a refusé la publication (${response.status})${responseText ? ` : ${responseText.slice(0, 180)}` : "."}`);
  }

  return payload;
}

export function verifyMakeWebhookRequest(body: string, secretHeader: string | null, signatureHeader: string | null) {
  const secret = process.env.MAKE_INSTAGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  if (secretHeader && safeCompare(secretHeader, secret)) {
    return true;
  }

  return Boolean(signatureHeader && safeCompare(signatureHeader, signMakeWebhookBody(body, secret)));
}

function signMakeWebhookBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getAppOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
