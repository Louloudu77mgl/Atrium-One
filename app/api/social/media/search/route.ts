import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { searchUnsplashMedia } from "@/lib/unsplash-search";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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

  const payload = await request.json() as {
    query?: string;
    title?: string;
    caption?: string;
    angle?: string;
    source?: string;
    visualPrompt?: string;
    limit?: number;
  };

  const assets = await searchUnsplashMedia({
    query: payload.query,
    businessType: merchant.business_type,
    title: payload.title,
    caption: payload.caption,
    angle: payload.angle,
    source: payload.source,
    visualPrompt: payload.visualPrompt,
    limit: payload.limit ?? 12
  });

  return NextResponse.json({ assets });
}
