import { NextResponse, type NextRequest } from "next/server";
import { getAppOriginFromHeaders, logGoogleLoginError, logGoogleLoginEvent } from "@/lib/auth/google-login";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeNextPath(value?: string | null) {
  if (!value) {
    return "/dashboard";
  }

  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/login?error=Configuration%20Supabase%20manquante", await getAppOriginFromHeaders()));
  }

  const supabase = await createServerSupabaseClient();
  const origin = await getAppOriginFromHeaders();
  const next = normalizeNextPath(new URL(request.url).searchParams.get("next"));
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  logGoogleLoginEvent("oauth_start", { redirectTo, next });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "select_account"
      }
    }
  });

  if (error || !data.url) {
    logGoogleLoginError("oauth_start_failed", {
      message: error?.message ?? "missing_oauth_url",
      redirectTo,
      next
    });

    return NextResponse.redirect(new URL("/login?error=google_login_unavailable", origin));
  }

  return NextResponse.redirect(data.url);
}
