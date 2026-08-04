import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getGoogleBusinessLocations } from "@/lib/google-business-profile";
import { getGoogleConnection, upsertGoogleConnection } from "@/lib/google-connections";
import { syncGoogleBusinessReviews } from "@/lib/google-review-sync";
import { getFreshGoogleAccessToken } from "@/lib/google-tokens";
import { getMerchant } from "@/lib/merchants";
import { getCurrentUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });
  const connection = await getGoogleConnection(merchant);
  if (!connection) return NextResponse.json({ error: "Google Business non connecté." }, { status: 409 });

  try {
    let connectionToSync = connection;

    if (!connection.google_location_id) {
      const accessToken = await getFreshGoogleAccessToken(connection, merchant);
      const locations = await getGoogleBusinessLocations(accessToken);

      if (locations.length === 1) {
        await upsertGoogleConnection({
          merchant_id: merchant.id,
          google_location_id: locations[0].locationId,
          google_location_name: locations[0].locationName,
          access_token_encrypted: accessToken,
          status: "connected",
          last_error: null
        }, merchant);
        connectionToSync = {
          ...connection,
          google_location_id: locations[0].locationId,
          google_location_name: locations[0].locationName,
          access_token_encrypted: accessToken,
          status: "connected"
        };
      } else if (request.headers.get("accept")?.includes("text/html")) {
        return NextResponse.redirect(new URL("/settings/google-business/select-location", request.url), 303);
      } else {
        return NextResponse.json({ error: "Fiche Google Business à sélectionner.", next: "/settings/google-business/select-location" }, { status: 409 });
      }
    }

    const imported = await syncGoogleBusinessReviews(connectionToSync, merchant);
    revalidatePath("/dashboard");
    revalidatePath("/reviews");
    revalidatePath("/integrations");
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/integrations?saved=google&imported=${imported}`, request.url), 303);
    }
    return NextResponse.json({ ok: true, imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronisation Google impossible.";
    await upsertGoogleConnection({ merchant_id: merchant.id, status: "connected", last_error: message }, merchant);
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/integrations?saved=google&imported=0&sync_error=${encodeURIComponent(message)}`, request.url), 303);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
