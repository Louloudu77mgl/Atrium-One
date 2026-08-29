import {
  classifyInstagramMetaError,
  createInstagramIntegrationError,
  getInstagramIntegrationErrorDetails,
  type InstagramFailureCode
} from "@/lib/instagram-errors";
import { getValidInstagramAccessToken, markInstagramConnectionFailure } from "@/lib/instagram-tokens";
import { validateDesignDocumentLayout } from "@/lib/social-editor/layout-safety";
import { isEditorDocument } from "@/lib/social-editor/types";
import { canPublishSocialDesignToInstagram, getPublishableInstagramImageUrl } from "@/lib/social-post-utils";
import type { MerchantRow, SocialPostRow } from "@/lib/supabase/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertBusinessFeatureAccessAdmin } from "@/lib/crm/access";

type GraphResponse = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
  status_code?: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
  status?: string;
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
};

export function getInstagramPublishErrorDetails(error: unknown) {
  const details = getInstagramIntegrationErrorDetails(error);
  return details ? { ...details, api_error: "Détail technique disponible uniquement dans les logs serveur." } : null;
}

export async function publishPostToInstagram({
  merchant,
  post,
  supabaseClient
}: {
  merchant: MerchantRow;
  post: SocialPostRow;
  supabaseClient?: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}) {
  await assertBusinessFeatureAccessAdmin(merchant.id, "instagram");
  if (!canPublishSocialDesignToInstagram(post)) {
    throw new Error("Une affiche RCU est un document A4 destiné à l’impression et ne peut pas être publiée sur Instagram.");
  }

  if (isEditorDocument(post.builder_state)) {
    const layoutErrors = validateDesignDocumentLayout(post.builder_state);
    if (layoutErrors.length > 0) {
      throw new Error(`Publication bloquée pour éviter un texte tronqué : ${layoutErrors[0]}`);
    }
  }

  const imageUrl = getPublishableInstagramImageUrl(post);

  if (!imageUrl) {
    throw new Error("Finalisez le visuel avant de le publier sur Instagram.");
  }

  const version = process.env.INSTAGRAM_GRAPH_API_VERSION ?? "v23.0";
  const caption = [post.caption, post.cta, post.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")].filter(Boolean).join("\n\n");
  const supabase = supabaseClient ?? await createServerSupabaseClient();
  let activePost = post;

  if (post.status !== "publishing") {
    const attemptStartedAt = new Date().toISOString();
    const { data: publishingPost, error: publishingError } = await supabase
      .from("social_posts")
      .update({
        status: "publishing",
        last_attempt_at: attemptStartedAt,
        retry_count: (post.retry_count ?? 0) + 1,
        failed_at: null,
        failure_code: null,
        error_message: null,
        updated_at: attemptStartedAt
      })
      .eq("id", post.id)
      .eq("merchant_id", merchant.id)
      .select("*")
      .single();
    if (publishingError) throw new Error(publishingError.message);
    activePost = publishingPost;
  }

  let publishData: GraphResponse;
  try {
    const { accessToken, connection } = await getValidInstagramAccessToken({ merchantId: merchant.id, supabaseClient: supabase });
    const createData = await requestInstagramGraph({
      url: `https://graph.instagram.com/${version}/${connection.instagram_account_id}/media`,
      method: "POST",
      endpoint: "/{instagram-user-id}/media",
      action: "instagram_create_media",
      failureCode: "media_container_failed",
      body: new URLSearchParams({ image_url: imageUrl, caption, access_token: accessToken }),
      fallbackMessage: "Instagram n’a pas accepté ce média."
    });
    if (!createData.id) {
      throw createInstagramError("Instagram n’a pas renvoyé l’identifiant du média.", {
        action: "instagram_create_media",
        method: "POST",
        endpoint: "/{instagram-user-id}/media",
        failureCode: "media_container_failed"
      });
    }

    await waitForInstagramContainer({
      containerId: createData.id,
      accessToken,
      version
    });

    publishData = await requestInstagramGraph({
      url: `https://graph.instagram.com/${version}/${connection.instagram_account_id}/media_publish`,
      method: "POST",
      endpoint: "/{instagram-user-id}/media_publish",
      action: "instagram_publish",
      failureCode: "media_publish_failed",
      body: new URLSearchParams({ creation_id: createData.id, access_token: accessToken }),
      fallbackMessage: "Instagram n’a pas pu publier ce post."
    });
    if (!publishData.id) {
      throw createInstagramError("Instagram n’a pas renvoyé l’identifiant de la publication.", {
        action: "instagram_publish",
        method: "POST",
        endpoint: "/{instagram-user-id}/media_publish",
        failureCode: "media_publish_failed"
      });
    }
  } catch (error) {
    const details = getInstagramPublishErrorDetails(error);
    const failedAt = new Date().toISOString();
    await supabase
      .from("social_posts")
      .update({
        status: "failed",
        published_at: null,
        failed_at: failedAt,
        failure_code: details?.failure_code ?? "graph_api_error",
        error_message: error instanceof Error ? error.message : "Publication Instagram impossible.",
        updated_at: failedAt
      })
      .eq("id", activePost.id)
      .eq("merchant_id", merchant.id);
    if (details && ["token_expired", "token_revoked", "account_inaccessible", "permissions_insufficient"].includes(details.failure_code)) {
      const status = details.failure_code === "token_expired"
        ? "expired"
        : details.failure_code === "token_revoked"
          ? "revoked"
          : "error";
      await markInstagramConnectionFailure({ merchantId: merchant.id, supabaseClient: supabase, status, message: error instanceof Error ? error.message : "Reconnectez Instagram." });
    }
    throw error;
  }

  const now = new Date().toISOString();
  const { data: updatedPost, error: updateError } = await supabase
    .from("social_posts")
    .update({
      status: "published",
      published_at: now,
      updated_at: now,
      last_saved_at: now,
      scheduled_at: null,
      error_message: null,
      failed_at: null,
      failure_code: null,
      instagram_media_id: publishData.id
    })
    .eq("id", activePost.id)
    .eq("merchant_id", merchant.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  await supabase
    .from("instagram_connections")
    .update({ last_sync_at: now, last_error: null })
    .eq("merchant_id", merchant.id);

  return updatedPost;
}

async function waitForInstagramContainer({
  containerId,
  accessToken,
  version
}: {
  containerId: string;
  accessToken: string;
  version: string;
}) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const url = new URL(`https://graph.instagram.com/${version}/${containerId}`);
    url.searchParams.set("fields", "status_code,status");
    url.searchParams.set("access_token", accessToken);
    const data = await requestInstagramGraph({
      url: url.toString(),
      method: "GET",
      endpoint: "/{creation-id}?fields=status_code,status",
      action: "instagram_check_media",
      failureCode: "media_processing_failed",
      fallbackMessage: "Instagram n’a pas pu vérifier le média."
    });
    if (data.status_code === "FINISHED" || data.status_code === "PUBLISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw createInstagramError(data.status || "Instagram n’a pas pu préparer le média.", {
        action: "instagram_check_media",
        method: "GET",
        endpoint: "/{creation-id}?fields=status_code,status",
        failureCode: "media_processing_failed"
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw createInstagramError("Instagram prépare encore le média. Réessayez la publication dans quelques instants.", {
    action: "instagram_check_media",
    method: "GET",
    endpoint: "/{creation-id}?fields=status_code,status",
    failureCode: "media_processing_failed"
  });
}

async function requestInstagramGraph({
  url,
  method,
  endpoint,
  action,
  failureCode,
  body,
  fallbackMessage
}: {
  url: string;
  method: "GET" | "POST";
  endpoint: string;
  action: string;
  failureCode: InstagramFailureCode;
  body?: URLSearchParams;
  fallbackMessage: string;
}) {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    throw createInstagramError(fallbackMessage, { action, method, endpoint, failureCode }, undefined, error instanceof Error ? error.message : fallbackMessage);
  }

  const rawBody = await response.text();
  let data: GraphResponse = {};
  try {
    data = rawBody ? JSON.parse(rawBody) as GraphResponse : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const apiMessage = (data.error?.message ?? rawBody.trim()) || fallbackMessage;
    const classified = classifyInstagramMetaError(data.error);
    const effectiveFailureCode = classified.failureCode === "graph_api_error" ? failureCode : classified.failureCode;
    throw createInstagramError(classified.userMessage, { action, method, endpoint, failureCode: effectiveFailureCode, httpStatus: response.status }, data.error?.code, apiMessage);
  }
  return data;
}

function createInstagramError(
  message: string,
  context: { action: string; method: "GET" | "POST"; endpoint: string; failureCode: InstagramFailureCode; httpStatus?: number | null },
  code?: number,
  apiError = message
) {
  return createInstagramIntegrationError({
    message,
    apiError,
    failureCode: context.failureCode,
    action: context.action,
    method: context.method,
    endpoint: context.endpoint,
    httpStatus: context.httpStatus,
    metaCode: code
  });
}
