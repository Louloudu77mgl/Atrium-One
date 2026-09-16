import { NextResponse } from "next/server";
import { getPublishedArticleBySlug } from "@/lib/articles";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const article = await getPublishedArticleBySlug((await params).slug);
    if (!article) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
    return NextResponse.json({ article }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
  }
}
