"use server";

import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getAppOriginFromHeaders } from "@/lib/auth/google-login";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/login?error=Configuration%20Supabase%20manquante");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("email_login_failed")}`);
  }

  redirect("/dashboard");
}

export async function loginWithGoogle() {
  redirect("/auth/google");
}

export async function requestPasswordReset(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/forgot-password?error=Configuration%20Supabase%20manquante");
  }

  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/forgot-password?error=Email%20requis");
  }

  const supabase = await createServerSupabaseClient();
  const origin = await getAppOriginFromHeaders();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent("reset_password_failed")}`);
  }

  redirect("/forgot-password?message=Si%20un%20compte%20existe%2C%20un%20email%20de%20r%C3%A9initialisation%20vient%20d%27%C3%AAtre%20envoy%C3%A9.");
}

export async function signup(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/signup?error=Configuration%20Supabase%20manquante");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabaseClient();
  const origin = await getAppOriginFromHeaders();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`
    }
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Compte%20créé.%20Connectez-vous%20pour%20continuer.");
}

export async function logout() {
  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
