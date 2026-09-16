import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : null;
  if (name.length < 2) return NextResponse.json({ error: "Le nom doit contenir au moins 2 caractères." }, { status: 400 });
  const { data, error } = await supabase.from("merchant_media_categories").insert({ merchant_id: merchant.id, name, description }).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Cette catégorie existe déjà." : error.message }, { status: 400 });
  return NextResponse.json({ category: data }, { status: 201 });
}
