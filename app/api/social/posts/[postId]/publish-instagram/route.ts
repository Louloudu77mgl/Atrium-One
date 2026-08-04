import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { dispatchInstagramPostToMake, hasMakeInstagramWebhookConfig } from "@/lib/make-instagram";
import { publishPostToInstagram } from "@/lib/social-publish";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  }

  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  }

  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (postError || !post) {
    return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
  }

  try {
    const instagramConnection = await getInstagramConnection(merchant);

    if (instagramConnection?.status === "connected") {
      const updatedPost = await publishPostToInstagram({ merchant, post, instagramConnection });
      revalidatePath("/social");
      return NextResponse.json({ post: updatedPost });
    }

    if (hasMakeInstagramWebhookConfig()) {
      const now = new Date().toISOString();
      const confirmationAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data: queuedPost, error: queueError } = await supabase
        .from("social_posts")
        .update({
          status: "ready",
          published_at: confirmationAt,
          error_message: null,
          updated_at: now,
          last_saved_at: now
        })
        .eq("id", post.id)
        .eq("merchant_id", merchant.id)
        .select("*")
        .single();

      if (queueError) {
        throw new Error(queueError.message);
      }

      const event = await dispatchInstagramPostToMake({ merchant, post: queuedPost });
      const { data: currentPost } = await supabase
        .from("social_posts")
        .select("*")
        .eq("id", post.id)
        .eq("merchant_id", merchant.id)
        .single();

      revalidatePath("/social");
      return NextResponse.json({ post: currentPost ?? queuedPost, queued: true, eventId: event.event_id });
    }

    throw new Error("Connectez le compte Instagram de cet établissement avant de publier.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publication Instagram impossible.";
    await supabase
      .from("social_posts")
      .update({ published_at: null, error_message: message, updated_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("merchant_id", merchant.id);

    return NextResponse.json({ error: message }, { status: 409 });
  }
}
