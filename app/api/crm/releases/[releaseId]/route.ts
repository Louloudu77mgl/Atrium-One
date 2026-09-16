import { NextResponse } from "next/server";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";
import type { CrmReleaseRow, Json } from "@/lib/supabase/types";

function list(value: unknown): Json | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 30) : undefined;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const { releaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const update: Partial<CrmReleaseRow> = { updated_at: now };
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim().slice(0, 160);
  if (typeof body.summary === "string" && body.summary.trim()) update.summary = body.summary.trim().slice(0, 600);
  if (typeof body.description === "string") update.description = body.description.trim().slice(0, 5000);
  if (/^\d{4}-\d{2}-\d{2}$/.test(body.releaseDate)) update.release_date = body.releaseDate;
  if (typeof body.version === "string") update.version = body.version.trim().slice(0, 40) || null;
  if (list(body.highlights)) update.highlights = list(body.highlights)!;
  if (list(body.improvements)) update.improvements = list(body.improvements)!;
  if (list(body.fixes)) update.fixes = list(body.fixes)!;
  if (typeof body.category === "string") update.category = body.category.trim().slice(0, 60) || "Produit";
  if (typeof body.emailSubject === "string") update.email_subject = body.emailSubject.trim().slice(0, 180) || null;
  if (typeof body.emailIntro === "string") update.email_intro = body.emailIntro.trim().slice(0, 1000) || null;
  if (body.status === "draft" || body.status === "published") {
    update.status = body.status;
    update.published_at = body.status === "published" ? now : null;
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("crm_releases").update(update).eq("id", releaseId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ release: data });
}
