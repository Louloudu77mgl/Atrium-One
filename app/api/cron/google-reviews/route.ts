import { NextResponse } from "next/server";
import { syncAllConnectedGoogleReviews } from "@/lib/google-review-auto-sync";
import { hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Configuration Supabase admin manquante." }, { status: 500 });
  }

  try {
    const results = await syncAllConnectedGoogleReviews();
    return NextResponse.json({
      ok: true,
      run_at: new Date().toISOString(),
      synchronized: results.filter((result) => !result.error).length,
      failed: results.filter((result) => result.error).length,
      imported: results.reduce((total, result) => total + result.imported, 0),
      results
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Synchronisation automatique impossible."
    }, { status: 500 });
  }
}
