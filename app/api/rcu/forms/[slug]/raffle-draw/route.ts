import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { drawRcuRaffle, getRcuRaffleStatus } from "@/lib/rcu-raffle-server";
import { getStoredRcuForm } from "@/lib/rcu-store";

async function getOwnedRaffle(slug: string) {
  const [merchant, form] = await Promise.all([getMerchant(), getStoredRcuForm(slug)]);
  if (!merchant || !form || form.merchant_id !== merchant.id || form.form_type !== "raffle") return null;
  return form;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await getOwnedRaffle(slug);
  if (!form) return NextResponse.json({ error: "Tombola introuvable." }, { status: 404 });
  try {
    const month = new URL(request.url).searchParams.get("month") ?? "";
    return NextResponse.json(await getRcuRaffleStatus({ form, month }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chargement impossible." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await getOwnedRaffle(slug);
  if (!form) return NextResponse.json({ error: "Tombola introuvable." }, { status: 404 });
  try {
    const payload = (await request.json()) as { month?: string };
    return NextResponse.json(await drawRcuRaffle({ form, month: payload.month ?? "" }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tirage impossible." }, { status: 400 });
  }
}
