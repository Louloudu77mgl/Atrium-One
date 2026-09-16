import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
export const articleSelect = "id,slug,title,excerpt,content,cover_image_url,status,author_id,published_at,created_at,updated_at" as const;

export function slugifyArticleTitle(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export async function getArticlesForAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("articles").select(articleSelect).order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPublishedArticles() {
  if (!hasSupabaseAdminEnv()) throw new Error("Configuration Supabase administrateur manquante");
  const { data, error } = await createSupabaseAdminClient().from("articles").select(articleSelect).eq("status", "published").not("published_at", "is", null).order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPublishedArticleBySlug(slug: string) {
  if (!hasSupabaseAdminEnv()) throw new Error("Configuration Supabase administrateur manquante");
  const { data, error } = await createSupabaseAdminClient().from("articles").select(articleSelect).eq("status", "published").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
