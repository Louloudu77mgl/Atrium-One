import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isCrmAdminEmail } from "@/lib/crm/access";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(isCrmAdminEmail(user?.email) ? "/crm" : "/dashboard");
}
