import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getConfiguredAdminEmails() {
  return (process.env.ATRIUMONE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  const adminEmails = getConfiguredAdminEmails();

  if (adminEmails.length === 0 && process.env.NODE_ENV !== "production") {
    return true;
  }

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
