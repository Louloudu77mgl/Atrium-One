import { NextResponse } from "next/server";
import { getPublishedArticles } from "@/lib/articles";

export async function GET() {
  try {
    return NextResponse.json({ articles: await getPublishedArticles() }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ articles: [] }, { status: 503 });
  }
}
