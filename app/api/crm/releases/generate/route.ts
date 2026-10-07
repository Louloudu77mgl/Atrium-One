import { NextResponse } from "next/server";
import { isCrmAdminEmail } from "@/lib/crm/access";
import { generateCrmNewsletter } from "@/lib/crm/newsletter-generation";
import { getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 90;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isCrmAdminEmail(user.email)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 10 || prompt.length > 6000) return NextResponse.json({ error: "Décrivez votre newsletter en 10 à 6 000 caractères." }, { status: 400 });
  try {
    return NextResponse.json({ draft: await generateCrmNewsletter(prompt, request.signal) });
  } catch {
    return NextResponse.json({ error: "Hans n’a pas pu terminer la newsletter. Votre contenu est conservé. Réessayez dans un instant." }, { status: 502 });
  }
}
