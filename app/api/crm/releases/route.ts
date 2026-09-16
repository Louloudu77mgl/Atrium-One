import { NextResponse } from "next/server";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

function stringList(value: unknown): Json {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 30) : [];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("crm_releases").select("*").order("release_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ releases: data });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 600) : "";
  if (!title || !summary) return NextResponse.json({ error: "Le titre et le résumé sont obligatoires." }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const status = body.status === "published" ? "published" : "draft";
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("crm_releases").insert({
    title,
    summary,
    description: typeof body.description === "string" ? body.description.trim().slice(0, 5000) : "",
    release_date: /^\d{4}-\d{2}-\d{2}$/.test(body.releaseDate) ? body.releaseDate : now.slice(0, 10),
    version: typeof body.version === "string" ? body.version.trim().slice(0, 40) || null : null,
    highlights: stringList(body.highlights),
    improvements: stringList(body.improvements),
    fixes: stringList(body.fixes),
    category: typeof body.category === "string" ? body.category.trim().slice(0, 60) || "Produit" : "Produit",
    status,
    email_subject: typeof body.emailSubject === "string" ? body.emailSubject.trim().slice(0, 180) || null : null,
    email_intro: typeof body.emailIntro === "string" ? body.emailIntro.trim().slice(0, 1000) || null : null,
    published_at: status === "published" ? now : null,
    created_by: user.id,
    updated_at: now
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ release: data }, { status: 201 });
}
