import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type MerchantNotificationStorage = "notification" | "automation_history";

export async function createMerchantNotification({
  supabase,
  merchantId,
  title,
  body
}: {
  supabase: SupabaseClient<Database>;
  merchantId: string;
  title: string;
  body: string;
}): Promise<MerchantNotificationStorage> {
  const { error } = await supabase.from("notifications").insert({
    merchant_id: merchantId,
    title,
    body,
    type: "hans_task_done",
    read: false
  });

  if (!error) {
    return "notification";
  }

  if (isMissingNotificationsTable(error.message)) {
    return "automation_history";
  }

  throw new Error(error.message);
}

function isMissingNotificationsTable(message: string) {
  const normalized = message.toLocaleLowerCase("fr-FR");
  return normalized.includes("public.notifications") && (
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table") ||
    normalized.includes("does not exist")
  );
}
