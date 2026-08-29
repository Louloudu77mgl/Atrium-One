import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EmailSegmentMode, EmailSegmentRule } from "@/lib/emailing-types";

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  segment_type: "automatic" | "custom" | "ai";
  rules: { combinator: "AND" | "OR"; rules: EmailSegmentRule[] };
  created_at: string;
  updated_at: string;
};

type SegmentQuery = PromiseLike<{ data: unknown; error: { message?: string } | null }> & {
  select: (columns: string) => SegmentQuery;
  eq: (column: string, value: string) => SegmentQuery;
  order: (column: string, options: { ascending: boolean }) => SegmentQuery;
  insert: (value: unknown) => SegmentQuery;
  single: () => SegmentQuery;
};

function asDatabase(client: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  return client as unknown as { from: (table: string) => SegmentQuery };
}

function rulesAreValid(value: unknown): value is EmailSegmentRule[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 12 && value.every((rule) => rule && typeof rule === "object" && typeof (rule as { id?: unknown }).id === "string");
}

function missingMigration(error: { message?: string } | null) {
  return Boolean(error?.message?.toLowerCase().includes("customer_segments"));
}

export async function GET() {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const supabase = asDatabase(await createServerSupabaseClient());
  const { data, error } = await supabase.from("customer_segments").select("id,name,description,segment_type,rules,created_at,updated_at").eq("merchant_id", merchant.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ segments: [], migrationRequired: missingMigration(error), error: missingMigration(error) ? undefined : error.message });
  return NextResponse.json({ segments: (data ?? []) as SegmentRow[], migrationRequired: false });
}

export async function POST(request: Request) {
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  const payload = await request.json() as { name?: string; description?: string; rules?: EmailSegmentRule[]; mode?: EmailSegmentMode };
  const name = payload.name?.trim().slice(0, 120) ?? "";
  if (!name || !rulesAreValid(payload.rules)) return NextResponse.json({ error: "Donnez un nom et au moins une condition au segment." }, { status: 400 });
  const supabase = asDatabase(await createServerSupabaseClient());
  const { data, error } = await supabase.from("customer_segments").insert({ merchant_id: merchant.id, name, description: payload.description?.trim().slice(0, 300) || null, segment_type: "custom", rules: { combinator: payload.mode === "any" ? "OR" : "AND", rules: payload.rules } }).select("id,name,description,segment_type,rules,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: missingMigration(error) ? "La migration de segmentation doit être exécutée dans Supabase avant d’enregistrer un segment." : error.message }, { status: missingMigration(error) ? 409 : 500 });
  return NextResponse.json({ segment: data as SegmentRow }, { status: 201 });
}
