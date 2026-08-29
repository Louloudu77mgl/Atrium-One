import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { hasSupabaseEnv } from "./env";
import { CRM_ADMIN_EMAIL, type CrmModule } from "@/lib/crm/types";

const publicMutationPrefixes = [
  "/auth",
  "/api/auth",
  "/api/cron",
  "/api/emailing/unsubscribe",
  "/api/emailing/track",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/onboarding"
];

function featureForPath(pathname: string): CrmModule | undefined {
  if (pathname.startsWith("/reviews/insights") || pathname.startsWith("/api/reviews/insights")) return "insights";
  if (pathname.startsWith("/reviews") || pathname.startsWith("/api/google") || pathname.startsWith("/api/hans/reply") || pathname.startsWith("/api/hans/publish")) return "reviews";
  if (pathname.startsWith("/social") || pathname.startsWith("/integrations/instagram") || pathname.startsWith("/api/social") || pathname.startsWith("/api/instagram")) return "instagram";
  if (pathname.startsWith("/api/hans") || pathname.startsWith("/settings/hans")) return "hans";
  if (pathname.startsWith("/automations") || pathname.startsWith("/api/automations")) return "automations";
  if (pathname.startsWith("/emailing") || pathname.startsWith("/api/emailing") || pathname.startsWith("/api/gmail")) return "emailing";
  if (pathname.startsWith("/rcu") || pathname.startsWith("/api/rcu")) return "rcu";
  if (pathname.startsWith("/fidelisation") || pathname.startsWith("/api/customer") || pathname.startsWith("/api/sms")) return "customers";
  return undefined;
}

function forbidden(request: NextRequest, code: string, message: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code, message, onboardingUrl: process.env.NEXT_PUBLIC_CSM_BOOKING_URL || null } }, { status: 403 });
  }
  const url = request.nextUrl.clone();
  url.pathname = request.nextUrl.pathname;
  url.searchParams.set("onboarding_required", "1");
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const isCrmAdmin = user.email?.toLowerCase() === CRM_ADMIN_EMAIL;
  const isCrmPath = pathname === "/crm" || pathname.startsWith("/crm/") || pathname.startsWith("/api/crm/");
  const isAuthExit = pathname === "/login" || pathname.startsWith("/auth/") || pathname === "/api/auth/logout";

  if (isCrmAdmin && !isCrmPath && !isAuthExit) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "CRM_ADMIN_ONLY", message: "Ce compte est réservé au CRM interne." } }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/crm";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isCrmAdmin && isCrmPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "CRM_FORBIDDEN", message: "Accès CRM refusé." } }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const isPublicFormSubmission = /^\/api\/(?:rcu|sms)\/forms\/[^/]+\/submit$/.test(pathname);
  const isPublicMutation = isPublicFormSubmission || publicMutationPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!isCrmAdmin && isMutation && !isPublicMutation) {
    const untyped = supabase as any;
    const { data: merchant } = await untyped.from("merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (merchant) {
      const { data: access, error: accessError } = await untyped.from("business_access").select("account_enabled").eq("business_id", merchant.id).maybeSingle();
      if (!accessError && !access?.account_enabled) {
        return forbidden(request, "ACCOUNT_DISABLED", "Votre espace AtriumOne doit être activé pendant votre onboarding.");
      }

      const feature = featureForPath(pathname);
      if (!accessError && feature) {
        const { data: moduleAccess } = await untyped.from("business_module_access").select("enabled").eq("business_id", merchant.id).eq("module_key", feature).maybeSingle();
        if (!moduleAccess?.enabled) {
          return forbidden(request, "FEATURE_DISABLED", "Cette fonctionnalité sera activée pendant votre onboarding.");
        }
      }
    }
  }

  return response;
}
