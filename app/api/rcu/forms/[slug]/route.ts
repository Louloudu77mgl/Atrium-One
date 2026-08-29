import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { deleteStoredRcuForm, updateStoredRcuStatus } from "@/lib/rcu-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const { slug } = await params;
  const payload = await request.json().catch(() => null) as { is_active?: unknown } | null;
  if (typeof payload?.is_active !== "boolean") {
    return NextResponse.json({ error: "État du RCU invalide." }, { status: 400 });
  }

  try {
    const form = await updateStoredRcuStatus({ merchantId: merchant.id, slug, isActive: payload.is_active });
    return NextResponse.json({ form });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const { slug } = await params;

  try {
    await deleteStoredRcuForm({ merchantId: merchant.id, slug });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suppression impossible." }, { status: 400 });
  }
}
