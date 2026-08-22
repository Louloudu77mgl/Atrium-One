import { NextResponse } from "next/server";
import { getInstagramConnection } from "@/lib/instagram-connections";
import { getMerchant } from "@/lib/merchants";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error" }, { status: 401 });
  }

  const merchant = await getMerchant();
  if (!merchant) {
    return NextResponse.json({ status: "error" }, { status: 404 });
  }

  const connection = await getInstagramConnection(merchant);

  return NextResponse.json(
    {
      status: connection?.status ?? "disconnected",
      username: connection?.instagram_username ?? null,
      connectedAt: connection?.connected_at ?? null
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
