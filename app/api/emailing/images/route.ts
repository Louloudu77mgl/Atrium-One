import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

const BUCKET = "emailing-images";
const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ error: "Configuration de stockage manquante." }, { status: 500 });
  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) return NextResponse.json({ error: "Choisissez une image." }, { status: 400 });
  if (!allowedTypes.includes(image.type) || image.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Utilisez une image PNG, JPG, WEBP ou GIF de moins de 5 Mo." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: bucket } = await supabase.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: allowedTypes });
    if (error && !error.message.toLowerCase().includes("already exists")) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${merchant.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: image.type, cacheControl: "31536000", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
