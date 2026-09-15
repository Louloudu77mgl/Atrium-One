import { NextResponse } from "next/server";
import { runWeeklySocialAutomations } from "@/lib/social-weekly-automation";
import { hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET manquant." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ error: "Configuration Supabase admin manquante." }, { status: 500 });

  try {
    const results = await runWeeklySocialAutomations();
    return NextResponse.json({
      processed: results.filter((result) => result.status === "completed").length,
      failed: results.filter((result) => result.status === "failed").length,
      results
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automatisation Instagram hebdomadaire impossible." }, { status: 500 });
  }
}
