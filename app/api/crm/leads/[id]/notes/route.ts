import { NextResponse, type NextRequest } from "next/server";
import { cleanText, crmErrorResponse, getCrmContext } from "@/lib/crm/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { user, supabase } = await getCrmContext(); const { id } = await params; const body = await request.json(); const content = cleanText(body.content, 10000); if (!content) return NextResponse.json({ error: { message: "La note est vide." } }, { status: 400 }); const { data, error } = await supabase.from("crm_notes").insert({ lead_id: id, content, created_by: user.id }).select("*").single(); if (error) throw error; return NextResponse.json(data, { status: 201 }); } catch (error) { return crmErrorResponse(error); }
}
