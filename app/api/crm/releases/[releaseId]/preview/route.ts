import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { getCrmGmailConnection, isCrmGmailReady } from "@/lib/crm/gmail";
import { renderAtriumOneReleaseEmail } from "@/lib/crm/release-email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const { releaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabaseClient();
  const { data: release } = await supabase.from("crm_releases").select("*").eq("id", releaseId).maybeSingle();
  if (!release) return NextResponse.json({ error: "Release introuvable." }, { status: 404 });
  const admin = createSupabaseAdminClient();
  const { data: audience, error: audienceError } = await admin.rpc("crm_active_release_audience");
  if (audienceError) return NextResponse.json({ error: audienceError.message }, { status: 500 });
  const connection = await getCrmGmailConnection();
  const html = renderAtriumOneReleaseEmail({ release, origin: getAppOriginFromRequest(request), introOverride: typeof body.intro === "string" ? body.intro : null });
  return NextResponse.json({ html, audienceCount: audience?.length ?? 0, gmailConnected: isCrmGmailReady(connection), gmailAddress: connection?.gmail_address ?? null, subject: typeof body.subject === "string" && body.subject.trim() ? body.subject.trim().slice(0, 180) : release.email_subject || `Nouveautés AtriumOne · ${release.title}` });
}
