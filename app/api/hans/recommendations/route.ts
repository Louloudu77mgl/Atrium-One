import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PatchRequest = {
  id?: string;
  status?: "todo" | "done";
};

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
  }

  const payload = (await request.json()) as PatchRequest;

  if (!payload.id || !payload.status) {
    return NextResponse.json({ error: "id et status sont requis." }, { status: 400 });
  }

  if (payload.id.startsWith("fallback-")) {
    return NextResponse.json({ ok: true, fallback: true });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("hans_recommendations")
    .update({
      status: payload.status,
      completed_at: payload.status === "done" ? new Date().toISOString() : null
    })
    .eq("id", payload.id)
    .select("id, status, completed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recommendation: data });
}
