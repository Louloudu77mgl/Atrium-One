import { NextResponse } from "next/server";
import { getInstagramFailureCode } from "@/lib/instagram-errors";
import { getValidInstagramAccessToken } from "@/lib/instagram-tokens";
import { createMerchantNotification } from "@/lib/merchant-notifications";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

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

  const supabase = createSupabaseAdminClient();
  const { data: connections, error } = await supabase
    .from("instagram_connections")
    .select("merchant_id,status")
    .in("status", ["connected", "expiring"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const connection of connections ?? []) {
    try {
      const valid = await getValidInstagramAccessToken({ merchantId: connection.merchant_id, supabaseClient: supabase });
      results.push({ merchantId: connection.merchant_id, status: valid.connection.status });
    } catch (validationError) {
      const failureCode = getInstagramFailureCode(validationError);
      const requiresReconnect = ["token_expired", "token_revoked", "permissions_insufficient", "account_inaccessible"].includes(failureCode);
      if (requiresReconnect && !["expired", "revoked"].includes(connection.status)) {
        await createMerchantNotification({
          supabase,
          merchantId: connection.merchant_id,
          title: "Connexion Instagram à renouveler",
          body: "Reconnectez Instagram pour reprendre les publications automatiques."
        });
      }
      console.error("[instagram/connection-health] failed", {
        merchantId: connection.merchant_id,
        failureCode,
        message: validationError instanceof Error ? validationError.message : "unknown_error"
      });
      results.push({ merchantId: connection.merchant_id, status: "failed", failureCode });
    }
  }

  return NextResponse.json({
    ok: true,
    runAt: new Date().toISOString(),
    checked: results.length,
    failed: results.filter((result) => result.status === "failed").length,
    results
  });
}
