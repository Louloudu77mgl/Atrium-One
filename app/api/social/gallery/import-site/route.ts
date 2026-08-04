import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { buildAutomaticAltText, extractImageCandidatesFromHtml } from "@/lib/social-gallery";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  }

  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  }

  const payload = await request.json() as { websiteUrl?: string };
  const websiteUrl = payload.websiteUrl?.trim() || merchant.website_url?.trim();

  if (!websiteUrl) {
    return NextResponse.json({ error: "Ajoutez l’URL du site dans Réglages pour importer les images." }, { status: 400 });
  }

  try {
    const targetUrl = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
    await supabase.from("merchants").update({ website_url: targetUrl.toString() }).eq("id", merchant.id);

    const response = await fetch(targetUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Le site n’a pas répondu correctement.");
    }

    const html = await response.text();
    const urls = extractImageCandidatesFromHtml(html, targetUrl).slice(0, 48);

    if (urls.length === 0) {
      return NextResponse.json({
        error: "Impossible de récupérer les images du site. Vous pouvez ajouter vos visuels manuellement."
      }, { status: 422 });
    }

    const rows = urls.map((url) => ({
      merchant_id: merchant.id,
      url,
      alt_text: buildAutomaticAltText({
        merchantName: merchant.business_name,
        businessType: merchant.business_type,
        context: targetUrl.hostname.replace(/^www\./, "")
      }),
      category: merchant.business_type,
      source: "website_scrape" as const
    }));

    const { data, error } = await supabase
      .from("merchant_media_assets")
      .upsert(rows, { onConflict: "merchant_id,url", ignoreDuplicates: true })
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: data ?? [] });
  } catch (error) {
    console.error("Import site images failed", error);
    return NextResponse.json({
      error: "Impossible d’importer les images du site pour le moment. Essayez l’upload manuel."
    }, { status: 422 });
  }
}
