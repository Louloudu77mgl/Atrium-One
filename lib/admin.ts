import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getConfiguredAdminEmails() {
  const configured = (process.env.ATRIUMONE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(["louisdacre@gmail.com", ...configured]));
}

export function isAdminEmail(email?: string | null) {
  const adminEmails = getConfiguredAdminEmails();

  return Boolean(email && adminEmails.includes(email.toLowerCase()));
}

export async function requireAdminUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  return user;
}
