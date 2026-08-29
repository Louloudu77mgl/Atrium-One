"use client";

import type {
  MerchantBrandSettingsRow,
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
}) {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#F5F1E9]">
      <iframe
        src={`/social-editor-canva-reference.html?v=20260828-fonts&postId=${encodeURIComponent(post.id)}${initialAction ? `&action=${encodeURIComponent(initialAction)}` : ""}${scheduledAt ? `&scheduledAt=${encodeURIComponent(scheduledAt)}` : ""}`}
        title="Éditeur de design du post"
        className="h-full w-full border-0"
      />
    </div>
  );
}
