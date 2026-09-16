import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createSocialDraftFromIdea, type DraftIdeaInput } from "@/lib/social-drafts";
import { RecommendationAlreadyUsedError } from "@/lib/social-recommendation-usage";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createInstagramStoryDraft } from "@/lib/social-stories";

export const maxDuration = 180;

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
  }

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

  try {
    const idea = (await request.json()) as DraftIdeaInput;
    // Older recommendation buttons send Story requests here. Preserve their
    // response contract while using the actual Story generation pipeline.
    if (idea.contentType === "story") {
      const post = await createInstagramStoryDraft({ merchant, idea, supabaseClient: supabase });
      return NextResponse.json({ post, imageUrl: post.visual_url });
    }
    const result = await createSocialDraftFromIdea({ merchant, idea });
    return NextResponse.json({ post: result.post, imageUrl: result.imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création du brouillon impossible.";
    return NextResponse.json({ error: message }, { status: error instanceof RecommendationAlreadyUsedError ? 409 : 500 });
  }
}
