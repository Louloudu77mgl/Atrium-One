import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_IMPERSONATION_COOKIE } from "@/lib/crm/impersonation-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.delete(ADMIN_IMPERSONATION_COOKIE);
  return response;
}
