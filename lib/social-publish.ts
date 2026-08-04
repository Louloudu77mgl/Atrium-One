import { getInstagramConnection } from "@/lib/instagram-connections";
import { validateDesignDocumentLayout } from "@/lib/social-editor/layout-safety";
import { isEditorDocument } from "@/lib/social-editor/types";
import type { InstagramConnectionRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type GraphResponse = { id?: string; error?: { message?: string } };

export async function publishPostToInstagram({
  merchant,
  post,
  instagramConnection,
  supabaseClient
}: {
  merchant: MerchantRow;
  post: SocialPostRow;
  instagramConnection?: InstagramConnectionRow | null;
  supabaseClient?: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}) {
  const connection = instagramConnection ?? await getInstagramConnection(merchant);

  if (connection?.status !== "connected" || !connection.instagram_account_id || !connection.access_token_encrypted) {
    throw new Error("La connexion Instagram n’est pas encore active. Vous pouvez créer un brouillon et publier plus tard.");
  }

  const generatedDocument = post.builder_state && typeof post.builder_state === "object" && !Array.isArray(post.builder_state)
    ? post.builder_state as Record<string, unknown>
    : null;
  const requiresComposedVisual = (generatedDocument?.version === 2 || generatedDocument?.version === "html-editor-v1") && Boolean(post.visual_text);

  if (isEditorDocument(post.builder_state)) {
    const layoutErrors = validateDesignDocumentLayout(post.builder_state);
    if (layoutErrors.length > 0) {
      throw new Error(`Publication bloquée pour éviter un texte tronqué : ${layoutErrors[0]}`);
    }
  }

  if (requiresComposedVisual && !post.visual_url) {
    throw new Error("Le visuel final avec texte doit être exporté avant la publication Instagram.");
  }

  const imageUrl = post.visual_url ?? post.image_url;

  if (!imageUrl || !imageUrl.startsWith("https://")) {
    throw new Error("Ajoutez d’abord une image publique pour publier sur Instagram.");
  }

  const version = process.env.INSTAGRAM_GRAPH_API_VERSION ?? "v23.0";
  const caption = [post.caption, post.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")].filter(Boolean).join("\n\n");

  const createResponse = await fetch(`https://graph.facebook.com/${version}/${connection.instagram_account_id}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: imageUrl, caption, access_token: connection.access_token_encrypted }),
    cache: "no-store"
  });
  const createData = await createResponse.json() as GraphResponse;

  if (!createResponse.ok || !createData.id) {
    throw new Error(createData.error?.message ?? "Instagram n’a pas accepté ce média.");
  }

  const publishResponse = await fetch(`https://graph.facebook.com/${version}/${connection.instagram_account_id}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: createData.id, access_token: connection.access_token_encrypted }),
    cache: "no-store"
  });
  const publishData = await publishResponse.json() as GraphResponse;

  if (!publishResponse.ok || !publishData.id) {
    throw new Error(publishData.error?.message ?? "Instagram n’a pas pu publier ce post.");
  }

  const supabase = supabaseClient ?? await createServerSupabaseClient();
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
      instagram_media_id: publishData.id
    })
    .eq("id", post.id)
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
