import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { associationStrength, buildBulkTaskRows, buildEventTitle, buildTaskTitle, calculateArr, dedupeProspects, distributeProspectsAcrossDays, exclusiveLeadIdsForSearch, findDuplicate, hasEffectiveModuleAccess, isCrmTimelineActivity, sortCalendarTasks } from "../lib/crm/logic.ts";
import { collectGooglePlacesPages } from "../lib/crm/places.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sqlV1 = read("../supabase/crm-cockpit.sql");
const sqlV2 = read("../supabase/crm-cockpit-v2.sql");
const middleware = read("../lib/supabase/middleware.ts");
const searchRoute = read("../app/api/crm/places/search/route.ts");
const importRoute = read("../app/api/crm/places/import/route.ts");
const searchDeleteRoute = read("../app/api/crm/searches/[id]/route.ts");
const bulkRoute = read("../app/api/crm/leads/bulk/route.ts");
const leadRoute = read("../app/api/crm/leads/[id]/route.ts");
const taskRoute = read("../app/api/crm/leads/[id]/tasks/route.ts");
const taskItemRoute = read("../app/api/crm/tasks/[id]/route.ts");
const eventRoute = read("../app/api/crm/leads/[id]/events/route.ts");
const calendar = read("../components/crm/CalendarWorkspace.tsx");
const calendarPlanRoute = read("../app/api/crm/calendar/plan/route.ts");
const taskBulkRoute = read("../app/api/crm/tasks/bulk/route.ts");
const calendarPage = read("../app/crm/calendar/page.tsx");
const crmHome = read("../app/crm/page.tsx");
const leadWorkspace = read("../components/crm/LeadDetailWorkspace.tsx");
const activityRoute = read("../app/api/crm/activity/[id]/route.ts");
const onboardingTestPage = read("../app/crm/onboarding-test/page.tsx");
const onboardingTestWorkspace = read("../components/crm/TestOnboardingWorkspace.tsx");
const crmSidebar = read("../components/crm/CrmSidebar.tsx");

test("sécurité — l’admin exact est isolé dans /crm et les autres utilisateurs sont refusés", () => {
  assert.match(sqlV1, /louisdacre@gmail\.com/);
  assert.match(middleware, /CRM_ADMIN_ONLY/);
  assert.match(middleware, /!isCrmAdmin && isCrmPath/);
  assert.match(sqlV1, /as restrictive for all to authenticated using \(not public\.is_atriumone_crm_admin\(\)\)/);
});

test("onboarding — account_enabled écrase toujours les modules", () => {
  assert.equal(hasEffectiveModuleAccess(false, true), false);
  assert.equal(hasEffectiveModuleAccess(true, true), true);
  assert.match(middleware, /ACCOUNT_DISABLED/);
  assert.match(middleware, /FEATURE_DISABLED/);
});

test("TEST 1 — la pagination automatique dépasse 60 résultats lorsque l’API fournit quatre pages", async () => {
  let calls = 0;
  const result = await collectGooglePlacesPages(async () => {
    calls += 1;
    return { places: Array.from({ length: 20 }, (_, index) => ({ id: `${calls}-${index}` })), nextPageToken: calls < 4 ? `page-${calls + 1}` : null };
  }, { maxPages: 5, maxResults: 100 });
  assert.equal(result.places.length, 80);
  assert.equal(result.pagesFetched, 4);
  assert.match(searchRoute, /GOOGLE_PLACES_MAX_RESULTS/);
});

test("TEST 2 — un Place ID dans trois recherches produit un lead et trois relations", () => {
  const unique = dedupeProspects([{ placeId: "place-1", name: "Institut", address: "1 rue A" }, { placeId: "place-1", name: "Institut", address: "1 rue A" }, { placeId: "place-1", name: "Institut", address: "1 rue A" }]);
  const relations = ["search-1", "search-2", "search-3"].map((searchId) => ({ searchId, leadId: "lead-1" }));
  assert.equal(unique.length, 1);
  assert.equal(new Set(relations.map((item) => `${item.searchId}:${item.leadId}`)).size, 3);
  assert.match(importRoute, /crm_search_leads/);
  assert.match(sqlV2, /primary key \(search_id, lead_id\)/);
});

test("déduplication globale — Place ID, domaine, téléphone, nom et adresse", () => {
  const leads = [{ id: "place", google_place_id: "p1", website: "one.fr", phone: "0101", name: "A", address: "1 rue A" }, { id: "domain", website: "https://www.domain.fr/contact" }, { id: "phone", phone: "+33 6 12 34 56 78" }, { id: "fingerprint", name: "Éclat Lille", address: "2, rue Nationale" }];
  assert.equal(findDuplicate(leads, { placeId: "p1", website: "other.fr" })?.id, "place");
  assert.equal(findDuplicate(leads, { website: "https://domain.fr" })?.id, "domain");
  assert.equal(findDuplicate(leads, { phone: "+33612345678" })?.id, "phone");
  assert.equal(findDuplicate(leads, { name: "Eclat Lille", address: "2 rue Nationale" })?.id, "fingerprint");
});

test("réimport après soft-delete — le lead existant est restauré au lieu d’être recréé", () => {
  const deleted = [{ id: "deleted", google_place_id: "place-1", deleted_at: "2026-08-30T00:00:00Z" }];
  assert.equal(findDuplicate(deleted, { placeId: "place-1" })?.deleted_at, "2026-08-30T00:00:00Z");
  assert.match(importRoute, /restoreProspects/);
  assert.match(importRoute, /deleted_at: null/);
  assert.match(importRoute, /\.\.\.restored/);
  assert.match(importRoute, /return NextResponse\.json\(\{ imported, restored, duplicates/);
});

test("TEST 3 — le calcul historique identifie correctement le lead exclusif et le lead partagé", () => {
  const relations = [{ searchId: "a", leadId: "exclusive" }, { searchId: "a", leadId: "shared" }, { searchId: "b", leadId: "shared" }];
  assert.deepEqual(exclusiveLeadIdsForSearch(relations, "a"), ["exclusive"]);
  assert.match(sqlV2, /other\.search_id <> target_search_id/);
});

test("cards de prospection — suppression indépendante de la base de leads", () => {
  assert.match(searchDeleteRoute, /from\("crm_searches"\)\.delete\(\)/);
  assert.match(searchDeleteRoute, /leadsPreserved: true/);
  assert.doesNotMatch(searchDeleteRoute, /delete_crm_search_with_exclusive_leads/);
});

test("TEST 4 — suppression individuelle reste un soft delete et préserve le compte", () => {
  assert.match(leadRoute, /deleted_at: new Date\(\)\.toISOString\(\)/);
  assert.match(leadRoute, /accountPreserved/);
  assert.match(sqlV1, /business_id uuid references public\.merchants\(id\) on delete set null/);
});

test("TEST 5 — suppression en masse met deleted_at sans toucher aux comptes", () => {
  assert.match(bulkRoute, /body\.action === "delete"/);
  assert.match(bulkRoute, /accountsPreserved: true/);
  assert.match(bulkRoute, /\.in\("id"/);
  assert.match(bulkRoute, /from\("crm_tasks"\)\.delete\(\)\.in\("lead_id", ids\)/);
});

test("TEST 6 — une tâche bulk sur dix leads crée dix lignes distinctes", () => {
  const leads = Array.from({ length: 10 }, (_, index) => ({ id: `lead-${index}`, name: `Entreprise ${index}` }));
  const rows = buildBulkTaskRows(leads, { type: "Appel", dueDate: "2026-09-02" });
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map((row) => row.lead_id)).size, 10);
  assert.match(bulkRoute, /crm_tasks/);
});

test("TEST 7 — le titre d’une tâche Appel est automatique", () => {
  assert.equal(buildTaskTitle("Appel", "Institut Camille"), "Appel - Institut Camille");
  assert.match(taskRoute, /buildTaskTitle/);
  assert.doesNotMatch(taskRoute, /body\.title/);
});

test("TEST 8 — le titre R1 est généré selon le format AtriumOne", () => {
  assert.equal(buildEventTitle("R1", "Institut Camille"), "R1 - AtriumOne x Institut Camille");
  assert.match(eventRoute, /buildEventTitle/);
});

test("TEST 9 — Appel effectué est écrit dans la timeline", () => {
  assert.match(sqlV2, /when 'Appel effectué' then 'call_completed'/);
  assert.match(sqlV2, /log_crm_event_activity/);
});

test("TEST 10 — MRR 100 donne ARR 1200 sans flottant incohérent", () => {
  assert.equal(calculateArr(100), 1200);
  assert.match(sqlV2, /numeric\(14,2\)/);
  assert.match(sqlV2, /generated always as \(mrr \* 12\) stored/);
});

test("TEST 11 — Affaire closée gagne l’opportunité, transforme le lead en Client et alimente les revenus", () => {
  assert.match(sqlV2, /create or replace function public\.close_crm_opportunity/);
  assert.match(sqlV2, /commercial_status = 'Client'/);
  assert.match(sqlV2, /monthly_value = opportunity_row\.mrr/);
  assert.match(sqlV2, /event_type := case new\.status when 'Gagnée' then 'deal_won'/);
});

test("TEST 12 — les tâches horaires précèdent les tâches sans horaire", () => {
  const sorted = sortCalendarTasks([{ id: "none", due_time: null }, { id: "late", due_time: "14:00" }, { id: "early", due_time: "09:00" }]);
  assert.deepEqual(sorted.map((item) => item.id), ["early", "late", "none"]);
});

test("TEST 13 — la checkbox calendrier renseigne et efface completed_at", () => {
  assert.match(taskItemRoute, /update\.completed_at = body\.completed \? new Date\(\)\.toISOString\(\) : null/);
  assert.match(calendar, /body: JSON\.stringify\(\{ completed: true \}\)/);
  assert.match(calendar, /current\.filter\(\(item\) => item\.id !== task\.id\)/);
});

test("TEST 14 — le calendrier affiche toujours le mois et l’année", () => {
  assert.match(calendar, /month: "long", year: "numeric"/);
  assert.match(calendar, /\{monthYear\}/);
});

test("calendrier cold call — une journée est une vraie page et non une modale", () => {
  assert.match(calendar, /Plan de journée/);
  assert.match(calendar, /Liste d’appels et d’actions/);
  assert.doesNotMatch(calendar, /ao-modal-backdrop/);
  assert.match(calendar, /returnTo=/);
});

test("calendrier cold call — les tâches sont numérotées et sélectionnables en masse", () => {
  assert.match(calendar, /aria-label="Tout sélectionner"/);
  assert.match(calendar, /startIndex \+ index \+ 1/);
  assert.match(calendar, /Marquer terminées/);
  assert.match(taskBulkRoute, /body\.action === "complete"/);
});

test("planificateur cold call — 60 prospects sont répartis sur chacun de deux jours", () => {
  const leads = Array.from({ length: 120 }, (_, index) => ({ id: `lead-${index}`, name: `Prospect ${index}` }));
  const result = distributeProspectsAcrossDays(leads, ["2026-09-03", "2026-09-07"], 60, "admin");
  assert.equal(result.rows.length, 120);
  assert.equal(result.counts["2026-09-03"], 60);
  assert.equal(result.counts["2026-09-07"], 60);
  assert.equal(result.rows.filter((row) => row.due_date === "2026-09-03").length, 60);
  assert.equal(result.rows.filter((row) => row.due_date === "2026-09-07").length, 60);
  assert.match(calendarPlanRoute, /alreadyPlanned/);
  assert.match(calendarPlanRoute, /excludedStatuses/);
});

test("planificateur cold call — les filtres sont appliqués côté serveur", () => {
  for (const field of ["city", "businessType", "status", "source", "minRating", "minReviews", "email", "website"]) assert.match(calendarPlanRoute, new RegExp(`filters\\.${field}`));
  assert.match(calendarPage, /plannerOptions/);
});

test("suppression lead — les tâches liées sont nettoyées et masquées du calendrier", () => {
  assert.match(leadRoute, /from\("crm_tasks"\)\.delete\(\)\.eq\("lead_id", id\)/);
  assert.match(calendarPage, /crm_leads!inner/);
  assert.match(calendarPage, /crm_leads\.deleted_at/);
});

test("timeline — seuls les appels, emails consignés et rendez-vous planifiés sont visibles", () => {
  assert.equal(isCrmTimelineActivity({ type: "call_completed" }), true);
  assert.equal(isCrmTimelineActivity({ type: "task_completed", metadata: { title: "Email - Institut Camille" } }), true);
  assert.equal(isCrmTimelineActivity({ type: "task_completed", metadata: { title: "Appel - Institut Camille" } }), true);
  assert.equal(isCrmTimelineActivity({ type: "r1_completed" }), true);
  assert.equal(isCrmTimelineActivity({ type: "note_added" }), false);
  assert.equal(isCrmTimelineActivity({ type: "deal_won" }), false);
  assert.match(leadWorkspace, /activity\.filter\(isCrmTimelineActivity\)/);
});

test("timeline — une entrée peut être supprimée sans supprimer sa tâche ou son RDV source", () => {
  assert.match(activityRoute, /from\("crm_activity"\)\.delete\(\)/);
  assert.doesNotMatch(activityRoute, /crm_tasks|crm_events/);
  assert.match(leadWorkspace, /Supprimer cette entrée de timeline/);
});

test("accueil CRM — les KPI sont calculés depuis les données sources", () => {
  for (const table of ["crm_leads", "crm_tasks", "crm_events", "crm_opportunities"]) assert.match(crmHome, new RegExp(`from\\("${table}"\\)`));
  assert.match(crmHome, /Pipeline MRR/);
  assert.match(crmHome, /MRR signé/);
  assert.match(crmHome, /Taux de closing/);
  assert.doesNotMatch(crmHome, /redirect\("\/crm\/prospection"\)/);
});

test("onboarding test — le guide couvre Google Business, Instagram Meta et Gmail", () => {
  assert.match(crmSidebar, /\/crm\/onboarding-test/);
  assert.match(onboardingTestWorkspace, /Google Business Profile/);
  assert.match(onboardingTestWorkspace, /Meta for Developers/);
  assert.match(onboardingTestWorkspace, /gmail\.send/);
  assert.match(onboardingTestWorkspace, /30 jours/);
  assert.match(onboardingTestWorkspace, /refresh tokens peuvent expirer après 7 jours/);
});

test("onboarding test — aucun secret client n’est demandé et les callbacks production sont explicites", () => {
  assert.match(onboardingTestWorkspace, /aucun mot de passe n’est collecté/i);
  assert.match(onboardingTestWorkspace, /Ne jamais demander ni stocker de mot de passe, code 2FA/);
  for (const callback of ["google", "gmail", "instagram"]) assert.match(onboardingTestWorkspace, new RegExp(`https:\\/\\/app\\.atrium-one\\.fr\\/api\\/${callback}\\/callback`));
});

test("onboarding test — l’état réel est lu sans sélectionner de jetons OAuth", () => {
  for (const table of ["business_access", "business_module_access", "google_connections", "instagram_connections", "gmail_connections"]) assert.match(onboardingTestPage, new RegExp(`from\\("${table}"\\)`));
  assert.doesNotMatch(onboardingTestPage, /access_token|refresh_token|client_secret/);
  assert.match(onboardingTestWorkspace, /localStorage\.setItem/);
});

test("association compte — email exact automatique, signaux faibles manuels", () => {
  assert.equal(associationStrength({ leadEmail: "CONTACT@EXEMPLE.FR", accountEmail: "contact@exemple.fr" }), "exact_email");
  assert.equal(associationStrength({ leadPhone: "06 00 00 00 00", accountPhone: "+33 6 00 00 00 00" }), "phone");
});

test("migration V2 — additive, RLS admin et backfills idempotents", () => {
  assert.match(sqlV2, /create table if not exists public\.crm_search_leads/);
  assert.match(sqlV2, /create table if not exists public\.crm_events/);
  assert.match(sqlV2, /create table if not exists public\.crm_opportunities/);
  assert.match(sqlV2, /on conflict on constraint crm_search_leads_pkey do nothing/);
  assert.match(sqlV2, /using \(public\.is_atriumone_crm_admin\(\)\)/);
});
