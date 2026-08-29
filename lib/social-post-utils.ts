import type { SocialPostRow } from "@/lib/supabase/types";

export function getPostStatusLabel(status: SocialPostRow["status"]) {
  const labels = {
    draft: "Brouillon",
    editing: "En cours",
    ready: "Prêt",
    exported: "Exporté",
    saved: "Sauvegardé",
    scheduled: "Planifié",
    publishing: "Publication en cours",
    published: "Publié",
    failed: "Échec",
    cancelled: "Annulé"
  };

  return labels[status];
}

export function getInstagramPostFailureMessage(post: Pick<SocialPostRow, "status" | "failure_code" | "error_message">) {
  if (post.status !== "failed") return null;
  if (["token_expired", "token_revoked", "permissions_insufficient", "account_inaccessible", "connection_invalid"].includes(post.failure_code ?? "")) {
    return "Reconnectez Instagram puis replanifiez cette publication.";
  }
  return "Cette publication n’a pas pu être envoyée. Vous pouvez la modifier puis réessayer.";
}

type PublishableSocialPost = Pick<
  SocialPostRow,
  "builder_state" | "visual_text" | "visual_url" | "image_url" | "template_id"
>;

export type SocialDesignKind = "instagram" | "rcu_poster";

export function getSocialDesignKind(post: Pick<SocialPostRow, "template_id">): SocialDesignKind {
  return post.template_id === "rcu-poster" ? "rcu_poster" : "instagram";
}

export function canPublishSocialDesignToInstagram(post: Pick<SocialPostRow, "template_id">) {
  return getSocialDesignKind(post) === "instagram";
}

export function getPublishableInstagramImageUrl(post: PublishableSocialPost) {
  if (!canPublishSocialDesignToInstagram(post)) return null;
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
