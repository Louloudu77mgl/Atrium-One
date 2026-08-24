import { NextResponse } from "next/server";
import {
  deleteStoredAutomationFlow,
  listStoredAutomationFlows,
  saveStoredAutomationFlow,
  type StoredAutomationFlow
} from "@/lib/automation-execution-store";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getAuthenticatedMerchant() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getMerchant();
}

export async function GET() {
  const merchant = await getAuthenticatedMerchant();
  if (!merchant) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });

  try {
    return NextResponse.json({ flows: await listStoredAutomationFlows(merchant.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lecture des scénarios impossible." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const merchant = await getAuthenticatedMerchant();
  if (!merchant) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });

  try {
    const payload = await request.json() as { flow?: StoredAutomationFlow };
    if (!isValidFlow(payload.flow)) {
      return NextResponse.json({ error: "Scénario invalide." }, { status: 400 });
    }
    const flow = await saveStoredAutomationFlow(merchant.id, payload.flow);
    return NextResponse.json({ flow });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sauvegarde du scénario impossible." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const merchant = await getAuthenticatedMerchant();
  if (!merchant) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });

  const flowId = new URL(request.url).searchParams.get("id");
  if (!flowId) return NextResponse.json({ error: "Identifiant du scénario manquant." }, { status: 400 });

  try {
    await deleteStoredAutomationFlow(merchant.id, flowId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suppression du scénario impossible." }, { status: 500 });
  }
}

function isValidFlow(flow: StoredAutomationFlow | undefined): flow is StoredAutomationFlow {
  return Boolean(
    flow &&
    typeof flow.id === "string" &&
    flow.id.length <= 160 &&
    typeof flow.title === "string" &&
    flow.title.trim().length > 0 &&
    flow.title.trim().length <= 100 &&
    Array.isArray(flow.nodes) &&
    flow.nodes.length <= 100 &&
    flow.nodes.every((node) => typeof node.id === "string" && typeof node.type === "string" && typeof node.category === "string") &&
    Array.isArray(flow.edges) &&
    flow.edges.length <= 200 &&
    flow.edges.every((edge) => typeof edge.id === "string" && typeof edge.source === "string" && typeof edge.target === "string")
  );
}
