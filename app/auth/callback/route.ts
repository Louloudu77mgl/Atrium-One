import { NextResponse, type NextRequest } from "next/server";
import { logGoogleLoginError, logGoogleLoginEvent, mapGoogleLoginErrorMessage } from "@/lib/auth/google-login";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const requestedNext = requestUrl.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";

  if (oauthError) {
    logGoogleLoginError("oauth_callback_error", {
      oauthError,
      errorDescription,
      next
    });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription ?? oauthError)}`, request.url));
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logGoogleLoginError("exchange_code_failed", {
        message: error.message,
        next
      });
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(mapGoogleLoginErrorMessage(error.message))}`, request.url));
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    logGoogleLoginEvent("oauth_callback_success", {
      userId: user?.id ?? null,
      next
    });

    if (!user) {
      logGoogleLoginError("missing_user_after_exchange", { next });
      return NextResponse.redirect(new URL("/login?error=google_session_missing", request.url));
    }
  }

  if (!code) {
    logGoogleLoginError("missing_code_in_callback", { next });
    return NextResponse.redirect(new URL("/login?error=google_code_missing", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
