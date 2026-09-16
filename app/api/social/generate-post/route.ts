import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { generateDraftContent, type DraftIdeaInput } from "@/lib/social-drafts";
import { composeAndStoreSocialPostVisual } from "@/lib/social-visuals";
import { resolveHansVisual } from "@/lib/hans-visual-source";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type GeneratedPost = {
  title: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visualPrompt: string;
  visualHook: string;
  visualSubtitle: string;
  format: "carré" | "story" | "carrousel simple";
};

type GeneratePostResponse = {
  post: GeneratedPost;
  imageUrl: string;
};

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

  const payload = (await request.json()) as DraftIdeaInput;
  const { draft } = await generateDraftContent({ merchant, idea: payload });
  const visual = await resolveHansVisual({
    merchant,
    title: draft.title,
    caption: draft.caption,
    visualPrompt: draft.visualPrompt,
    subject: payload.source ?? payload.angle ?? draft.title,
    preferredCategoryName: draft.mediaCategory,
    format: "social",
    supabaseClient: supabase
  });
  const readyVisualUrl = visual.imageUrl ? await composeAndStoreSocialPostVisual({
    merchant,
    imageUrl: visual.imageUrl,
    visualHook: draft.visualHook,
    subtitle: draft.visualSubtitle
  }) : "";

  return NextResponse.json({ post: draft, imageUrl: readyVisualUrl } satisfies GeneratePostResponse);
}
