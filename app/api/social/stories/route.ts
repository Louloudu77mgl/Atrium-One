import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { publishPostToInstagram } from "@/lib/social-publish";
import { createInstagramStoryDraft } from "@/lib/social-stories";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DraftIdeaInput } from "@/lib/social-drafts";

export const maxDuration = 180;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const { data, error } = await supabase.from("social_posts").select("*").eq("merchant_id", merchant.id).eq("media_kind", "story").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stories: data });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  const payload = await request.json().catch(() => null) as { idea?: DraftIdeaInput; scheduledAt?: string | null; publishNow?: boolean } | null;
  if (!payload?.idea || (!payload.idea.title && !payload.idea.angle)) return NextResponse.json({ error: "Décrivez la Story à créer." }, { status: 400 });
  if (payload.scheduledAt) {
    const scheduled = new Date(payload.scheduledAt);
    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) return NextResponse.json({ error: "Choisissez une date future." }, { status: 400 });
  }
  try {
    const story = await createInstagramStoryDraft({ merchant, idea: payload.idea, scheduledAt: payload.scheduledAt ?? null, autoPublish: Boolean(payload.publishNow), supabaseClient: supabase });
    if (!payload.publishNow) return NextResponse.json({ story }, { status: 201 });
    try {
      const published = await publishPostToInstagram({ merchant, post: story, supabaseClient: supabase });
      return NextResponse.json({ story: published }, { status: 201 });
    } catch (cause) {
      // Generation succeeded: return the same draft so the client can retry or
      // download it, rather than generating another Story after a Meta failure.
      const { data } = await supabase.from("social_posts").select("*").eq("id", story.id).eq("merchant_id", merchant.id).single();
      return NextResponse.json({ story: data ?? story, publicationError: cause instanceof Error ? cause.message : "Publication impossible. Réessayez depuis la Story." }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Création de la Story impossible." }, { status: 409 });
  }
}
