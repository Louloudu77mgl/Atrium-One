import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  const { categoryId } = await params;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : undefined;
  if (name.length < 2) return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
  const { data, error } = await supabase.from("merchant_media_categories").update({ name, ...(description !== undefined ? { description } : {}), updated_at: new Date().toISOString() }).eq("id", categoryId).eq("merchant_id", merchant.id).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Cette catégorie existe déjà." : error.message }, { status: 400 });
  await supabase.from("merchant_media_assets").update({ category: name, updated_at: new Date().toISOString() }).eq("merchant_id", merchant.id).eq("category_id", categoryId);
  return NextResponse.json({ category: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  const { categoryId } = await params;
  const body = await request.json().catch(() => ({}));
  const { data: category } = await supabase.from("merchant_media_categories").select("name").eq("id", categoryId).eq("merchant_id", merchant.id).maybeSingle();
  if (!category) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
  if (category.name === "Autres") return NextResponse.json({ error: "La catégorie Autres sert de catégorie de repli." }, { status: 400 });
  const requestedTarget = typeof body.destinationCategoryId === "string" ? body.destinationCategoryId : null;
  const targetQuery = supabase.from("merchant_media_categories").select("id,name").eq("merchant_id", merchant.id);
  const { data: target } = requestedTarget
    ? await targetQuery.eq("id", requestedTarget).neq("id", categoryId).maybeSingle()
    : await targetQuery.eq("name", "Autres").maybeSingle();
  if (!target) return NextResponse.json({ error: "Catégorie de destination introuvable." }, { status: 400 });
  const { error: moveError } = await supabase.from("merchant_media_assets").update({ category_id: target.id, category: target.name, updated_at: new Date().toISOString() }).eq("merchant_id", merchant.id).eq("category_id", categoryId);
  if (moveError) return NextResponse.json({ error: moveError.message }, { status: 400 });
  const { error } = await supabase.from("merchant_media_categories").delete().eq("id", categoryId).eq("merchant_id", merchant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, destinationCategoryId: target.id });
}
