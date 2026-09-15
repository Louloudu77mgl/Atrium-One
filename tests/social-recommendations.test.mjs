import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildCreatePostHref, getRecommendationOrigin, isRecommendationPublished, isRecommendationUsed, parisDateKey, preserveRecommendationOrigin, readRecommendationOrigin, recommendationWeek, selectRecommendationMix, withRecommendationOrigin, withoutRecommendationOrigin } from "../lib/social-recommendation-shared.ts";
import { buildAutomationSlots, getRecommendedPublishingDays } from "../lib/social-automation-shared.ts";
import { parseLocalEventIdeas, searchLocalEventIdeas } from "../lib/social-local-event-search.ts";

const idea = (theme, negative = false) => ({ platform: "instagram", title: `Découvrir ${theme}`, angle: `Un conseil concernant ${theme}`, ...(negative ? { sourcePainPoint: theme } : { sourceStrength: theme }) });
const post = (source, status = "published") => ({ id: "post-1", platform: "instagram", status, title: "Un titre complètement différent", caption: "Une légende modifiée manuellement", builder_state: withRecommendationOrigin({ version: 2, elements: [] }, source) });
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("le thème d'origine survit au renommage, à l'éditeur et à la transformation d'image", () => {
  const source = idea("Accueil chaleureux");
  const original = post(source);
  const edited = preserveRecommendationOrigin({ version: 2, elements: [{ text: "Autre texte" }], _recommendation: getRecommendationOrigin(idea("Autre sujet")) }, original.builder_state);
  assert.deepEqual(readRecommendationOrigin(edited), getRecommendationOrigin(source));
  assert.equal(isRecommendationPublished({ ...source, title: "Un nouveau titre de reco" }, [{ ...original, builder_state: edited }]), true);
  assert.equal(readRecommendationOrigin(preserveRecommendationOrigin(edited, null)), null);
  assert.deepEqual(preserveRecommendationOrigin(null, edited), edited);
  assert.match(read("../app/api/social/posts/[postId]/route.ts"), /preserveRecommendationOrigin\(payload.builder_state, existingPost.builder_state\)/);
  assert.match(read("../app/api/social/visuals/transform/route.ts"), /preserveRecommendationOrigin\(designDocument, existingPost.builder_state\)/);
});

test("une recommandation associée à un post disparaît dès le brouillon, tout en distinguant la publication", () => {
  const source = idea("Délais d'attente", true);
  for (const status of ["draft", "editing", "scheduled", "publishing", "failed", "cancelled", "exported"]) {
    assert.equal(isRecommendationPublished(source, [post(source, status)]), false, status);
    assert.equal(isRecommendationUsed(source, [post(source, status)]), true, status);
  }
  assert.equal(isRecommendationPublished(source, [post(source)]), true);
  assert.equal(isRecommendationUsed(source, [post(source)]), true);
  assert.equal(isRecommendationPublished(source, [{ ...post(source), platform: "facebook" }]), false);
  assert.equal(isRecommendationUsed(source, [{ ...post(source), platform: "facebook" }]), false);
  assert.equal(isRecommendationPublished(idea("Choix des fleurs"), [post(source)]), false);
  assert.equal(readRecommendationOrigin(withoutRecommendationOrigin(post(source).builder_state)), null);
});

test("un post planifié libère une place pour un autre thème de la réserve", () => {
  const insights = Array.from({ length: 14 }, (_, index) => idea(`Sujet numéro ${index}`));
  const before = selectRecommendationMix([insights, [], []], [], 10);
  const after = selectRecommendationMix([insights, [], []], [post(before[0], "scheduled")], 10);
  assert.equal(after.length, 10);
  assert.equal(after.some((item) => item.title === before[0].title), false);
  assert.equal(after.some((item) => item.title === insights[10].title), true);
  assert.deepEqual(selectRecommendationMix([[insights[0]], [], []], [post(insights[0])]), []);
});

test("deux posts hebdomadaires sont répartis le mardi et le vendredi sans doublon", () => {
  assert.deepEqual(getRecommendedPublishingDays("Restaurant", 2), [2, 5]);
  const slots = buildAutomationSlots({ cycleWeeks: 1, postsPerCycle: 2, businessType: "Restaurant", fromDate: new Date("2026-09-14T08:00:00Z") });
  assert.deepEqual(slots.map((slot) => slot.getDay()), [2, 5]);
  const denseSlots = buildAutomationSlots({ cycleWeeks: 1, postsPerCycle: 7, fromDate: new Date("2026-09-14T08:00:00Z") });
  assert.equal(new Set(denseSlots.map((slot) => slot.getTime())).size, 7);
});

test("les événements ont des places réservées même avec une grande réserve Insights", () => {
  const insights = Array.from({ length: 15 }, (_, index) => idea(`Thème ${index}`));
  const local = { platform: "instagram", title: "Marché local", angle: "Découvrir le quartier", localEvent: "Marché local", eventDate: "2026-09-12", sourceUrl: "https://example.org/agenda" };
  const calendar = { platform: "instagram", title: "Halloween", angle: "Préparer la fête", seasonalMoment: "Halloween", eventDate: "2026-10-31" };
  const selected = selectRecommendationMix([insights, [local], [calendar]], [], 10, "2026-09-03");
  assert.equal(selected.length, 10);
  assert.ok(selected.includes(local));
  assert.ok(selected.includes(calendar));
  assert.equal(selectRecommendationMix([[], [local], []], [], 10, "2026-09-13").length, 0);
  assert.equal(isRecommendationPublished({ ...calendar, eventDate: "2027-10-31" }, [post(calendar)]), false);
});

test("les champs de source positifs/négatifs et événementiels traversent le CTA", () => {
  const negative = idea("Disponibilité des pivoines", true);
  const params = new URL(buildCreatePostHref(negative), "https://app.atrium-one.fr").searchParams;
  assert.equal(params.get("sourcePainPoint"), negative.sourcePainPoint);
  assert.equal(params.has("sourceStrength"), false);
  assert.equal(getRecommendationOrigin(idea("Accueil")).sourceType, "positive_review");
  assert.equal(getRecommendationOrigin(negative).sourceType, "negative_review");
  assert.equal(getRecommendationOrigin(idea("Qualité, été !")).themeKey, getRecommendationOrigin(idea("qualite ete")).themeKey);
});

test("la semaine change le lundi à minuit Paris, été comme hiver", () => {
  assert.equal(parisDateKey(new Date("2026-09-06T22:00:00Z")), "2026-09-07");
  assert.equal(recommendationWeek(new Date("2026-09-06T21:59:59Z")), "2026-08-31");
  assert.equal(recommendationWeek(new Date("2026-09-06T22:00:00Z")), "2026-09-07");
  assert.equal(recommendationWeek(new Date("2026-12-27T23:00:00Z")), "2026-12-28");
});

const event = { name: "Marché des créateurs", city: "Lyon", date: "2026-09-12", title: "Un samedi créatif", angle: "Découvrir les créations du quartier, sans partenariat annoncé", sourceUrl: "https://example.org/agenda/marche" };
const searchBody = (events) => ({ output_text: JSON.stringify({ events }), output: [{ type: "web_search_call", action: { sources: [{ url: event.sourceUrl }] } }] });

test("la veille refuse événements sans source consultée, passés, mauvaise ville, date invalide", () => {
  const body = searchBody([event, event, { ...event, city: "Paris" }, { ...event, date: "2025-09-12" }, { ...event, date: "2026-02-30" }, { ...event, date: "2026-12-20" }, { ...event, sourceUrl: "https://invented.example/event" }, { ...event, sourceUrl: "javascript:alert(1)" }]);
  const result = parseLocalEventIdeas(body, "lyon", "Fleuriste", "2026-08-31");
  assert.equal(result.length, 1);
  assert.equal(result[0].localEvent, event.name);
  assert.equal(result[0].sourceUrl, event.sourceUrl);
  assert.equal(parseLocalEventIdeas({ output_text: JSON.stringify({ events: [event] }) }, "lyon", "Fleuriste", "2026-08-31").length, 0);
});

test("la requête web utilise ville/date, impose la recherche, conserve les sources et a un timeout", async () => {
  let request;
  const result = await searchLocalEventIdeas({ city: "Lyon", businessType: "Fleuriste", week: "2026-08-31", apiKey: "test-only", model: "test-model", fetcher: async (_url, options) => {
    request = options;
    return Response.json(searchBody([event]));
  } });
  const body = JSON.parse(request.body);
  assert.equal(body.tool_choice, "required");
  assert.deepEqual(body.include, ["web_search_call.action.sources"]);
  assert.match(JSON.parse(body.input).query, /Lyon 2026-08-31 événements/);
  assert.ok(request.signal instanceof AbortSignal);
  assert.equal(result.length, 1);
  await assert.rejects(searchLocalEventIdeas({ city: "Lyon", businessType: "Fleuriste", week: "2026-08-31", apiKey: "test-only", model: "test-model", fetcher: async () => new Response("unavailable", { status: 503 }) }));
});

test("la veille est hebdomadaire et indépendante de l'arrivée d'avis", () => {
  const cache = read("../lib/social-local-events.ts");
  assert.match(cache, /unstable_cache/);
  assert.match(cache, /recommendationWeek\(referenceDate\)/);
  const cron = read("../app/api/cron/review-insights/route.ts");
  assert.ok(cron.indexOf("await getUpcomingLocalSocialIdeas") < cron.indexOf("if (!force && !hasReviewInsightsSourceChanged"));
  assert.doesNotMatch(read("../lib/social-recommendations.ts"), /reviews.length < 5/);
  assert.doesNotMatch(read("../lib/review-insights-server.ts"), /getTopSocialRecommendations/);
});

test("les créations manuelles et automatiques conservent la même origine", () => {
  assert.match(read("../lib/social-drafts.ts"), /withRecommendationOrigin\(designDocument, idea\)/);
  assert.match(read("../lib/social-automation.ts"), /withRecommendationOrigin\(designDocument, idea\)/);
  assert.doesNotMatch(read("../lib/social-automation.ts"), /ideas\[index %/);
  assert.match(read("../lib/social-publish.ts"), /revalidatePath\("\/social\/create"\)/);
  assert.match(read("../lib/social-automation.ts"), /reserveSocialRecommendation/);
  assert.match(read("../lib/social-publish.ts"), /syncSocialRecommendationLifecycleForPost/);
  assert.match(read("../app/api/social/posts/[postId]/duplicate/route.ts"), /withoutRecommendationOrigin/);
  assert.match(read("../app/api/cron/social-publish/route.ts"), /\["scheduled", "failed"\]/);
  assert.match(read("../app/api/cron/social-publish/route.ts"), /\.eq\("status", row.status\)/);
  assert.match(read("../vercel.json"), /social-automation/);
  assert.doesNotMatch(read("../app/reviews/ReviewsPageClient.tsx"), /automationSummary|getAutomationSummary/);
  assert.match(read("../app/social/SocialPageClient.tsx"), /setPosts\(initialPosts\)/);
});

test("la migration verrouille un thème par commerce et une exécution par semaine", () => {
  const migration = read("../supabase/social-recommendation-lifecycle.sql");
  const lifecycle = read("../lib/social-recommendation-usage.ts");
  assert.match(migration, /unique \(merchant_id, theme_key\)/);
  assert.match(migration, /unique \(merchant_id, week_start\)/);
  assert.match(migration, /status in \('reserved', 'used', 'scheduled', 'published'\)/);
  assert.match(lifecycle, /STALE_RESERVATION_MS/);
  assert.match(lifecycle, /\.eq\("reservation_token", existing.reservation_token\)/);
});
