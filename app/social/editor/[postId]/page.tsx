import { VisualPostEditor } from "./VisualPostEditor";
import { getAppShellData } from "@/lib/app-shell-data";
import { getBrandSettings } from "@/lib/brand-settings";
import { getSocialPostById } from "@/lib/social-posts";

export const dynamic = "force-dynamic";

export default async function SocialVisualEditorPage({
  params,
  searchParams
}: {
  params: Promise<{ postId: string }>;
  searchParams?: Promise<{ action?: string; scheduledAt?: string }>;
}) {
  const { postId } = await params;
  const editorAction = await searchParams;
  const { merchant } = await getAppShellData();
  const post = await getSocialPostById(postId, merchant);
  const brandSettings = await getBrandSettings(merchant);

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
