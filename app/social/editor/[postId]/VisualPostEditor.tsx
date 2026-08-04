"use client";

import type {
  MerchantBrandSettingsRow,
  MerchantMediaAssetRow,
  MerchantRow,
  SocialPostRow
} from "@/lib/supabase/types";

export function VisualPostEditor({
  post,
  initialAction,
  scheduledAt
}: {
  post: SocialPostRow;
  initialAction?: string;
  scheduledAt?: string;
  merchant?: MerchantRow | null;
  brandSettings?: MerchantBrandSettingsRow | null;
  galleryAssets?: MerchantMediaAssetRow[];
}) {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#F5F1E9]">
      <iframe
        src={`/social-editor-canva-reference.html?postId=${encodeURIComponent(post.id)}${initialAction ? `&action=${encodeURIComponent(initialAction)}` : ""}${scheduledAt ? `&scheduledAt=${encodeURIComponent(scheduledAt)}` : ""}`}
        title="Éditeur de design du post"
        className="h-full w-full border-0"
      />
    </div>
  );
}
