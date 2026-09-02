import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!supabaseUrl || !serviceRoleKey || !googleApiKey) throw new Error("Variables Supabase ou Google Places manquantes.");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: leads, error } = await supabase.from("crm_leads")
  .select("id,google_place_id")
  .not("google_place_id", "is", null)
  .is("google_opening_hours", null)
  .is("deleted_at", null)
  .limit(2000);
if (error) throw error;

let updated = 0;
let failed = 0;
for (let index = 0; index < (leads ?? []).length; index += 6) {
  const batch = leads.slice(index, index + 6);
  await Promise.all(batch.map(async (lead) => {
    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(lead.google_place_id)}`, {
        headers: { "X-Goog-Api-Key": googleApiKey, "X-Goog-FieldMask": "regularOpeningHours" },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error(`Google Places ${response.status}`);
      const place = await response.json();
      const { error: updateError } = await supabase.from("crm_leads").update({ google_opening_hours: place.regularOpeningHours ?? {} }).eq("id", lead.id);
      if (updateError) throw updateError;
      updated += 1;
    } catch (batchError) {
      failed += 1;
      console.error(`Échec pour le lead ${lead.id}:`, batchError instanceof Error ? batchError.message : "erreur inconnue");
    }
  }));
  console.log(`${Math.min(index + batch.length, leads.length)}/${leads.length} fiches traitées`);
}

console.log(`Backfill terminé : ${updated} fiches mises à jour, ${failed} échecs.`);
if (failed) process.exitCode = 1;
