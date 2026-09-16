import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getMerchantMediaLibrary } from "@/lib/merchant-media";
import { uploadMerchantMedia } from "@/lib/merchant-media-upload";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  return NextResponse.json(await getMerchantMediaLibrary(merchant.id, supabase));
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });

  try {
    const formData = await request.formData();
    const categoryId = String(formData.get("category_id") ?? "").trim();
    const altText = String(formData.get("alt_text") ?? "").trim() || null;
    const files = [...formData.getAll("images"), ...formData.getAll("image")]
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (!categoryId || !files.length) {
      return NextResponse.json({ error: "Choisissez une catégorie et au moins une photo." }, { status: 400 });
    }
    if (files.length > 20) return NextResponse.json({ error: "20 photos maximum par import." }, { status: 400 });

    const assets = [];
    const failures: { filename: string; error: string }[] = [];
    for (const file of files) {
      try {
        assets.push(await uploadMerchantMedia({ client: supabase, merchant, file, categoryId, altText }));
      } catch (error) {
        failures.push({ filename: file.name.slice(0, 180), error: error instanceof Error ? error.message : "Import impossible." });
      }
    }
    if (!assets.length) return NextResponse.json({ error: failures[0]?.error ?? "Import impossible.", failures }, { status: 400 });
    return NextResponse.json({ assets, failures }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import impossible." }, { status: 400 });
  }
}
