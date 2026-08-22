import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getInstagramConnection } from "@/lib/instagram-connections";
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

    if (instagramConnection?.status !== "connected") {
      throw new Error("Connectez le compte Instagram de cet établissement avant de publier.");
    }

    const updatedPost = await publishPostToInstagram({ merchant, post, instagramConnection });
    revalidatePath("/social");
    return NextResponse.json({ post: updatedPost });
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
