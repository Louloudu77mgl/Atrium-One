import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { MERCHANT_MEDIA_BUCKET } from "@/lib/merchant-media";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  const { assetId } = await params;
  const body = await request.json().catch(() => ({}));
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : null;
  const altText = typeof body.altText === "string" ? body.altText.trim().slice(0, 500) : undefined;
  let categoryName: string | undefined;

  if (categoryId) {
    const { data: category } = await supabase.from("merchant_media_categories").select("name").eq("id", categoryId).eq("merchant_id", merchant.id).maybeSingle();
    if (!category) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
    categoryName = category.name;
  }

  const { data, error } = await supabase.from("merchant_media_assets").update({
    ...(categoryId ? { category_id: categoryId, category: categoryName } : {}),
    ...(altText !== undefined ? { alt_text: altText || null } : {}),
    updated_at: new Date().toISOString()
  }).eq("id", assetId).eq("merchant_id", merchant.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ asset: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  const { assetId } = await params;
  const { data: asset } = await supabase.from("merchant_media_assets").select("storage_path").eq("id", assetId).eq("merchant_id", merchant.id).maybeSingle();
  if (!asset) return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  if (asset.storage_path) {
    const { error: storageError } = await supabase.storage.from(MERCHANT_MEDIA_BUCKET).remove([asset.storage_path]);
    if (storageError) return NextResponse.json({ error: "La photo n’a pas pu être supprimée du stockage." }, { status: 500 });
  }
  const { error } = await supabase.from("merchant_media_assets").delete().eq("id", assetId).eq("merchant_id", merchant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
