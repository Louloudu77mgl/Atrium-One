import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { decideVisualSource, rankMediaCategories, selectBestMerchantAsset } from "../lib/merchant-media-selection.ts";

const require = createRequire(import.meta.url);
const { load } = require("../scripts/emailing-test-loader.cjs");
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/media-stories-releases.sql");
const storyRecommendationsMigration = read("../supabase/story-recommendations-upgrade.sql");

test("le clic de recommandation appelle le bon générateur et ouvre le bon aperçu", async () => {
  const originalFetch = global.fetch;
  try {
    for (const kind of ["post", "story"]) {
      const navigations = [];
      const requests = [];
      const errors = [];
      const { CreatePostButton } = load("components/CreatePostButton.tsx", {
        react: { useState: (initial) => [initial, () => {}] },
        "next/navigation": { useRouter: () => ({ push: (path) => navigations.push(path) }) },
        "@/components/HansGeneratingModal": { HansGeneratingModal: () => null },
        "@/components/Toast": { Toast: () => null },
        "@/hooks/useToast": { useToast: () => ({ toast: null, showToast: (message, status) => { if (status === "error") errors.push(message); } }) },
        "@/lib/user-feedback": { getUserErrorMessage: (error) => error.message }
      });
      global.fetch = async (url, options) => {
        requests.push({ url, payload: JSON.parse(options.body) });
        return Response.json({ [kind]: { id: "created-id", media_kind: kind === "story" ? "story" : "feed" } });
      };
      const params = new URLSearchParams({ title: "Notre savoir-faire", angle: "Les gestes du quotidien", sourceStrength: "Savoir-faire", ...(kind === "story" ? { contentType: "story" } : {}) });
      const component = CreatePostButton({ href: `${kind === "story" ? "/social/stories/create" : "/social/create"}?${params}`, className: "" });
      await component.props.children[0].props.onClick();
      assert.deepEqual(errors, []);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, kind === "story" ? "/api/social/stories" : "/api/social/drafts");
      const idea = kind === "story" ? requests[0].payload.idea : requests[0].payload;
      assert.equal(idea.sourceStrength, "Savoir-faire");
      if (kind === "story") assert.equal(idea.contentType, "story");
      assert.deepEqual(navigations, [kind === "story" ? "/social/stories/created-id" : "/social/editor/created-id"]);
    }
  } finally { global.fetch = originalFetch; }
});

test("une ancienne demande Story à l’API drafts reste une Story, avec authentification", async () => {
  let signedIn = true;
  const calls = [];
  const merchant = { id: "merchant" };
  const client = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: "user" } : null } }) } };
  const { POST } = load("app/api/social/drafts/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/merchants": { getMerchant: async () => merchant },
    "@/lib/supabase/env": { hasSupabaseEnv: () => true },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client },
    "@/lib/social-recommendation-usage": { RecommendationAlreadyUsedError: class extends Error {} },
    "@/lib/social-drafts": { createSocialDraftFromIdea: async () => { throw new Error("Le générateur post ne doit pas être appelé"); } },
    "@/lib/social-stories": { createInstagramStoryDraft: async (input) => { calls.push(input); return { id: "story-id", media_kind: "story", visual_url: "https://example.com/story.jpg" }; } }
  });
  const request = () => new Request("https://app.atrium-one.fr/api/social/drafts", { method: "POST", body: JSON.stringify({ contentType: "story", title: "Notre équipe" }) });
  const result = await POST(request());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).post.media_kind, "story");
  assert.equal(calls[0].merchant.id, merchant.id);
  assert.equal(calls[0].supabaseClient, client);
  signedIn = false;
  assert.equal((await POST(request())).status, 401);
  assert.equal(calls.length, 1);
});

test("l’ancien éditeur redirige une Story vers son aperçu vertical", async () => {
  const { default: Page } = load("app/social/editor/[postId]/page.tsx", {
    "./VisualPostEditor": { VisualPostEditor: () => null },
    "@/lib/app-shell-data": { getAppShellData: async () => ({ merchant: { id: "merchant" } }) },
    "@/lib/brand-settings": { getBrandSettings: async () => null },
    "@/lib/social-posts": { getSocialPostById: async () => ({ id: "story-id", media_kind: "story" }) },
    "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } }
  });
  await assert.rejects(Page({ params: Promise.resolve({ postId: "story-id" }) }), /redirect:\/social\/stories\/story-id/);
});

test("média — la sélection sémantique comprend les catégories personnalisées et les fallbacks", () => {
  const categories = [
    { id: "balayage", name: "Balayages", description: "Résultats couleur et transformations capillaires" },
    { id: "team", name: "Notre équipe", description: "Portraits des collaborateurs" },
    { id: "other", name: "Autres", description: null }
  ];
  assert.equal(rankMediaCategories({ subject: "Nos meilleurs balayages", categories })[0].id, "balayage");
  assert.equal(rankMediaCategories({ subject: "Venez rencontrer notre équipe", categories })[0].id, "team");
  const asset = (id, category_id, use_count = 0) => ({ id, category_id, alt_text: id, use_count, last_used_at: null, created_at: "2026-09-01T00:00:00Z" });
  assert.equal(selectBestMerchantAsset({ subject: "balayage lumineux", categories, assets: [asset("portrait", "team"), asset("couleur", "balayage")] })?.id, "couleur");
  assert.equal(selectBestMerchantAsset({ subject: "produit", categories, assets: [asset("fallback", "other")] })?.id, "fallback");
  assert.equal(selectBestMerchantAsset({ subject: "produit", categories, assets: [] }), null);
});

test("média — IA, commerce et alternance ont une politique déterministe", () => {
  assert.deepEqual(decideVisualSource("ai", "merchant", true), { source: "ai", advance: false });
  assert.deepEqual(decideVisualSource("merchant", "merchant", false), { source: "none", advance: false });
  assert.deepEqual(decideVisualSource("mixed", "merchant", true), { source: "merchant", advance: true });
  assert.deepEqual(decideVisualSource("mixed", "ai", true), { source: "ai", advance: true });
  assert.deepEqual(decideVisualSource("mixed", "merchant", false), { source: "ai", advance: false });
  assert.match(read("../lib/merchant-media.ts"), /\.eq\("sequence_version", preference\.sequence_version\)/);
});

test("média — upload, catégories, suppression Storage et isolation merchant sont contrôlés côté serveur", () => {
  const upload = read("../lib/merchant-media-upload.ts");
  const assetRoute = read("../app/api/settings/media/assets/[assetId]/route.ts");
  const categoryRoute = read("../app/api/settings/media/categories/[categoryId]/route.ts");
  assert.match(upload, /MERCHANT_MEDIA_MAX_BYTES/);
  assert.match(upload, /failOn: "warning"/);
  assert.match(upload, /\.webp\(/);
  assert.match(upload, /merchant\.id/);
  assert.match(assetRoute, /\.eq\("merchant_id", merchant\.id\)/);
  assert.match(assetRoute, /MERCHANT_MEDIA_BUCKET\)\.remove/);
  assert.match(categoryRoute, /destinationCategoryId/);
  assert.match(categoryRoute, /category\.name === "Autres"/);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\].*auth\.uid/s);
});

test("Stories — format 9:16, publication Meta Business, retry et idempotence réutilisent le pipeline social", () => {
  const visuals = read("../lib/social-visuals.ts");
  const publish = read("../lib/social-publish.ts");
  const cron = read("../app/api/cron/social-publish/route.ts");
  const recommendations = read("../lib/social-recommendations.ts");
  const storyCreator = read("../app/social/stories/create/SocialCreateStoryClient.tsx");
  assert.match(visuals, /width: 1080, height: 1920/);
  assert.match(visuals, /buildStoryTemplate/);
  assert.match(visuals, /show_logo_on_social_posts/);
  assert.match(recommendations, /getTopStoryRecommendations/);
  assert.match(recommendations, /contentType: "story"/);
  assert.match(storyCreator, /initialIdea/);
  assert.match(storyCreator, /contentType: "story"/);
  assert.match(storyRecommendationsMigration, /add column if not exists media_kind/);
  assert.match(storyRecommendationsMigration, /Hans imagine désormais vos Stories/);
  assert.match(publish, /media_type: "STORIES"/);
  assert.match(publish, /instagram_account_type !== "BUSINESS"/);
  assert.match(publish, /activePost\.meta_container_id/);
  assert.match(publish, /meta_container_id: containerId/);
  assert.match(publish, /containerStatus === "PUBLISHED"/);
  assert.match(cron, /\.eq\("status", row\.status\)/);
  assert.match(cron, /retry_count/);
});

test("Instagram — une migration optionnelle manquante ne fait pas tomber les pages authentifiées", async () => {
  const { getInstagramConnectionSummary } = load("lib/instagram-connections.ts", {
    "@/lib/merchants": { getMerchant: async () => { throw new Error("merchant inattendu"); } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => { throw new Error("client inattendu"); } }
  });
  const selects = [];
  const responses = [
    { data: null, error: { message: "column instagram_connections.instagram_account_type does not exist" } },
    { data: { id: "connection", merchant_id: "merchant", instagram_username: "demo", connected_at: null, last_sync_at: null, last_error: null, status: "connected", token_expires_at: null, last_checked_at: null, updated_at: "2026-09-16T10:00:00Z" }, error: null }
  ];
  const supabase = {
    from() {
      const query = {
        select(columns) { selects.push(columns); return query; },
        eq() { return query; },
        async maybeSingle() { return responses.shift(); }
      };
      return query;
    }
  };

  const connection = await getInstagramConnectionSummary({ id: "merchant" }, supabase);
  assert.equal(selects.length, 2);
  assert.match(selects[0], /instagram_account_type/);
  assert.doesNotMatch(selects[1], /instagram_account_type/);
  assert.equal(connection.instagram_account_type, null);
  assert.equal(connection.instagram_username, "demo");
});

test("Stories — le pipeline Meta publie, reprend un conteneur publié et journalise les erreurs sans doublon", async () => {
  const merchant = { id: "merchant", user_id: "owner" };
  const story = { id: "story", merchant_id: merchant.id, media_kind: "story", status: "publishing", builder_state: null, caption: "Story", cta: "Découvrir", hashtags: [], visual_url: "https://assets.example/story.jpg", image_url: null, retry_count: 1, meta_container_id: null, instagram_media_id: null };
  const makeSupabase = () => {
    const updates = [];
    return {
      updates,
      from(table) {
        let update = {};
        const query = {
          update(value) { update = value; updates.push({ table, value }); return query; },
          eq() { return query; },
          select() { return query; },
          async single() { return { data: { ...story, ...update }, error: null }; },
          async maybeSingle() { return { data: { ...story, ...update }, error: null }; }
        };
        return query;
      }
    };
  };
  const loadPublisher = () => load("lib/social-publish.ts", {
    "next/cache": { revalidatePath: () => undefined },
    "@/lib/crm/access": { assertBusinessFeatureAccessAdmin: async () => undefined },
    "@/lib/instagram-errors": {
      classifyInstagramMetaError: () => ({ failureCode: "graph_api_error", userMessage: "Meta refuse le média." }),
      createInstagramIntegrationError: ({ message, ...details }) => Object.assign(new Error(message), { details }),
      getInstagramIntegrationErrorDetails: (error) => error?.details ?? null
    },
    "@/lib/instagram-tokens": {
      getValidInstagramAccessToken: async () => ({ accessToken: "token", connection: { id: "connection", instagram_account_id: "ig-user", instagram_account_type: "BUSINESS" } }),
      markInstagramConnectionFailure: async () => undefined
    },
    "@/lib/social-editor/layout-safety": { validateDesignDocumentLayout: () => [] },
    "@/lib/social-editor/types": { isEditorDocument: () => false },
    "@/lib/social-post-utils": { canPublishSocialDesignToInstagram: () => true, getPublishableInstagramImageUrl: (post) => post.visual_url },
    "@/lib/social-recommendation-usage": { syncSocialRecommendationLifecycleForPost: async () => undefined },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => { throw new Error("client inattendu"); } }
  }).publishPostToInstagram;
  const originalFetch = global.fetch;
  try {
    const requests = [];
    global.fetch = async (url, request = {}) => {
      requests.push({ url: String(url), request });
      if (requests.length === 1) return Response.json({ id: "container-1" });
      if (requests.length === 2) return Response.json({ status_code: "FINISHED" });
      return Response.json({ id: "media-1" });
    };
    const firstClient = makeSupabase();
    const published = await loadPublisher()({ merchant, post: story, supabaseClient: firstClient });
    assert.equal(requests.length, 3);
    assert.match(String(requests[0].request.body), /media_type=STORIES/);
    assert.ok(firstClient.updates.some((entry) => entry.value.meta_container_id === "container-1"));
    assert.equal(published.status, "published");

    requests.length = 0;
    global.fetch = async (url, request = {}) => { requests.push({ url: String(url), request }); return Response.json({ status_code: "PUBLISHED" }); };
    const retryClient = makeSupabase();
    await loadPublisher()({ merchant, post: { ...story, meta_container_id: "container-1", instagram_media_id: "media-1" }, supabaseClient: retryClient });
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /container-1/);

    global.fetch = async () => Response.json({ error: { message: "permission denied", code: 10 } }, { status: 403 });
    const failedClient = makeSupabase();
    await assert.rejects(loadPublisher()({ merchant, post: story, supabaseClient: failedClient }), /Meta refuse/);
    assert.ok(failedClient.updates.some((entry) => entry.value.status === "failed"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("Automatisations — recettes Stories, répartition hebdomadaire et verrou distinct par canal", () => {
  const templates = read("../app/automations/automation-builder/templates.ts");
  const weekly = read("../lib/social-weekly-automation.ts");
  assert.match(templates, /Story Instagram hebdomadaire/);
  assert.match(templates, /Stories Instagram régulières/);
  assert.match(templates, /generate_instagram_story/);
  assert.match(templates, /publish_instagram_story/);
  assert.match(weekly, /ensureAutomatedInstagramStories/);
  assert.match(weekly, /automation_kind/);
  assert.match(migration, /unique index.*social_automation_weekly_runs_merchant_week_kind_key/s);
});

test("Releases — permissions admin, audience active, HTML assaini, Gmail séparé et envoi idempotent", () => {
  const releaseRoute = read("../app/api/crm/releases/route.ts");
  const preview = read("../app/api/crm/releases/[releaseId]/preview/route.ts");
  const send = read("../app/api/crm/releases/[releaseId]/send/route.ts");
  const email = read("../lib/crm/release-email.ts");
  const crmGmail = read("../lib/crm/gmail.ts");
  assert.match(releaseRoute, /isCrmAdminEmail/);
  assert.match(preview, /crm_active_release_audience/);
  assert.match(migration, /account_enabled = true/);
  assert.match(migration, /onboarding_status = 'active'/);
  assert.match(email, /sanitizeEmailHtml/);
  assert.match(email, /Nouveautés AtriumOne/);
  assert.match(crmGmail, /crm_gmail_connections/);
  assert.match(crmGmail, /server-only/);
  assert.match(crmGmail, /aes-256-gcm/);
  assert.doesNotMatch(crmGmail, /from\("gmail_connections"\)/);
  assert.match(migration, /revoke all on public\.crm_gmail_connections from anon, authenticated/);
  assert.match(send, /idempotencyKey/);
  assert.match(send, /code === "23505"/);
  assert.match(send, /gmail_message_id/);
  assert.match(send, /\.in\("status", \["pending", "failed"\]\)/);
});

test("la contribution fonctionnelle impose une Release utilisateur", () => {
  assert.match(read("../AGENTS.md"), /modification fonctionnelle visible par l’utilisateur/);
  assert.match(migration, /Vos contenus deviennent encore plus personnels/);
});
