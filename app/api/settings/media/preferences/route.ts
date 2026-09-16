import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (!(["ai", "merchant", "mixed"] as const).includes(body.mode)) {
    return NextResponse.json({ error: "Préférence invalide." }, { status: 400 });
  }
  const { data, error } = await supabase.from("merchant_visual_preferences").upsert({
    merchant_id: merchant.id,
    image_source_mode: body.mode,
    updated_at: new Date().toISOString()
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preference: data });
}
