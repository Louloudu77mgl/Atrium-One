import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createSocialDraftFromIdea, type DraftIdeaInput } from "@/lib/social-drafts";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    const result = await createSocialDraftFromIdea({ merchant, idea });
    return NextResponse.json({ post: result.post, imageUrl: result.imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création du brouillon impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
