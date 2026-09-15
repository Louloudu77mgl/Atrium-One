import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { CRM_ADMIN_EMAIL } from "@/lib/crm/types";
import { getAdminImpersonationSession, sealAdminImpersonationSession } from "@/lib/crm/impersonation-session";
import { ADMIN_IMPERSONATION_COOKIE, ADMIN_IMPERSONATION_MAX_AGE_SECONDS } from "@/lib/crm/impersonation-constants";
import type { Database } from "./types";
import { getSupabaseEnv, hasSupabaseEnv } from "./env";

export async function createSessionSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; middleware refreshes sessions.
        }
      }
    }
  });
}

export const getCurrentUser = cache(async function getCurrentUser() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createSessionSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
});

function withAdminAuthentication(
  sessionClient: SupabaseClient<Database>,
  merchantClient: SupabaseClient<Database>
) {
  return new Proxy(sessionClient, {
    get(target, property) {
      const source = property === "auth" ? target : merchantClient;
      const value = Reflect.get(source, property, source);
      return typeof value === "function" ? value.bind(source) : value;
    }
  });
}

export const createServerSupabaseClient = cache(async function createServerSupabaseClient(): Promise<SupabaseClient<Database>> {
  const sessionClient = await createSessionSupabaseClient();
  const impersonation = await getAdminImpersonationSession();
  if (!impersonation) return sessionClient;

  const adminUser = await getCurrentUser();
  if (adminUser?.email?.trim().toLowerCase() !== CRM_ADMIN_EMAIL) return sessionClient;

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const merchantClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
  const { data, error } = await merchantClient.auth.setSession({
    access_token: impersonation.accessToken,
    refresh_token: impersonation.refreshToken
  });

  if (error || !data.user || data.user.id !== impersonation.userId || !data.session) return sessionClient;

  if (data.session.access_token !== impersonation.accessToken || data.session.refresh_token !== impersonation.refreshToken) {
    try {
      const cookieStore = await cookies();
      cookieStore.set(ADMIN_IMPERSONATION_COOKIE, sealAdminImpersonationSession({
        ...impersonation,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600
      }), {
        httpOnly: true,
        maxAge: ADMIN_IMPERSONATION_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      });
    } catch {
      // Les Server Components ne peuvent pas toujours actualiser le cookie ; la session courante reste utilisable.
    }
  }

  return withAdminAuthentication(sessionClient, merchantClient);
});
