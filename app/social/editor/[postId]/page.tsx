import { VisualPostEditor } from "./VisualPostEditor";
import { getAppShellData } from "@/lib/app-shell-data";
import { getBrandSettings } from "@/lib/brand-settings";
import { getSocialPostById } from "@/lib/social-posts";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SocialVisualEditorPage({
  params,
  searchParams
}: {
  params: Promise<{ postId: string }>;
  searchParams?: Promise<{ action?: string; scheduledAt?: string }>;
}) {
  const [{ postId }, editorAction, { merchant }] = await Promise.all([
    params,
    searchParams,
    getAppShellData({ reviews: "none", google: false })
  ]);
  const [post, brandSettings] = await Promise.all([
    getSocialPostById(postId, merchant),
    getBrandSettings(merchant)
  ]);

  if (post.media_kind === "story") redirect(`/social/stories/${post.id}`);

  return (
    <VisualPostEditor
      merchant={merchant}
      post={post}
      brandSettings={brandSettings}
      initialAction={editorAction?.action}
      scheduledAt={editorAction?.scheduledAt}
    />
  );
}
