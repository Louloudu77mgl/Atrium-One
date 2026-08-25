import type { SocialPostRow } from "@/lib/supabase/types";

export function getPostStatusLabel(status: SocialPostRow["status"]) {
  const labels = {
    draft: "Brouillon",
    editing: "En cours",
    ready: "Prêt",
    exported: "Exporté",
    saved: "Sauvegardé",
    scheduled: "Planifié",
    published: "Publié"
  };

  return labels[status];
}

type PublishableSocialPost = Pick<
  SocialPostRow,
  "builder_state" | "visual_text" | "visual_url" | "image_url"
>;

export function getPublishableInstagramImageUrl(post: PublishableSocialPost) {
  const document = post.builder_state && typeof post.builder_state === "object" && !Array.isArray(post.builder_state)
    ? post.builder_state as Record<string, unknown>
    : null;
  const requiresComposedVisual = (
    document?.version === 2 || document?.version === "html-editor-v1"
  ) && Boolean(post.visual_text);

  if (post.visual_url?.startsWith("https://")) return post.visual_url;
  if (!requiresComposedVisual && post.image_url?.startsWith("https://")) return post.image_url;
  return null;
}
