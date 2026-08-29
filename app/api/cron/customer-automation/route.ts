import { NextResponse } from "next/server";
import { runScheduledCustomerAutomations } from "@/lib/customer-automation-runner";
import { hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ error: "Configuration Supabase admin manquante." }, { status: 500 });
  try {
    const results = await runScheduledCustomerAutomations(100);
    return NextResponse.json({ ok: true, run_at: new Date().toISOString(), processed: results.length, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Veille clients impossible." }, { status: 500 });
  }
}
