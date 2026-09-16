import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { uploadMerchantMedia } from "@/lib/merchant-media-upload";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const categoryName = (String(formData.get("category") ?? "Autres").trim() || "Autres").slice(0, 60);
    const altText = String(formData.get("alt_text") ?? "").trim() || null;
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Image manquante." }, { status: 400 });

    let { data: category } = await supabase.from("merchant_media_categories").select("id,name").eq("merchant_id", merchant.id).ilike("name", categoryName).maybeSingle();
    if (!category) {
      const { data, error } = await supabase.from("merchant_media_categories").insert({ merchant_id: merchant.id, name: categoryName }).select("id,name").single();
      if (error) throw new Error(error.message);
      category = data;
    }
    const asset = await uploadMerchantMedia({ client: supabase, merchant, file, categoryId: category.id, altText });
    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import impossible." }, { status: 400 });
  }
}
