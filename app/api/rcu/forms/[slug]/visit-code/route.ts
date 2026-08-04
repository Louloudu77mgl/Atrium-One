import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { updateStoredRcuVisitCode } from "@/lib/rcu-store";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const { slug } = await params;
  const payload = (await request.json().catch(() => ({}))) as { code?: string };
  try {
    const form = await updateStoredRcuVisitCode({ merchantId: merchant.id, slug, code: payload.code });
    return NextResponse.json({ form });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status: 400 });
  }
}
