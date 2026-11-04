import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { load } = require("../scripts/emailing-test-loader.cjs");

function loadGenerator() {
  return load("lib/social-visuals.ts", {
    "@/lib/story-template": {},
    "@/lib/story-editorial": {},
    "@/lib/emailing-image-prompt": { emailImagePrompt: () => "" },
    "next/og": {},
    "@/lib/brand-settings": { getBrandSettings: async () => null },
    "@/lib/social-editor/layout-safety": { fitEstimatedText: () => null },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => assert.fail("Le client fourni doit être réutilisé") }
  }).generateAndStoreSocialVisual;
}

function createSupabase() {
  const uploads = [];
  const inserts = [];
  return {
    uploads,
    inserts,
    client: {
      auth: { getUser: async () => ({ data: { user: { id: "crm-admin" } } }) },
      storage: {
        from: () => ({
          upload: async (path, bytes, options) => {
            uploads.push({ path, bytes, options });
            return { error: null };
          },
          getPublicUrl: (path) => ({ data: { publicUrl: `https://assets.example/${path}` } })
        })
      },
      from: () => ({
        insert: async (record) => {
          inserts.push(record);
          return { error: null };
        }
      })
    }
  };
}

const merchant = {
  id: "merchant",
  user_id: "owner",
  business_name: "Maison Test",
  business_type: "Boulangerie",
  city: "Lyon",
  description: null
};

test("Instagram — une erreur OpenAI temporaire est retentée puis l'image est stockée", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_IMAGE_MODEL;
  const requests = [];
  const supabase = createSupabase();
  process.env.OPENAI_API_KEY = "test-only";
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-1";
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/images/generations");
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) {
      return Response.json({ error: { code: "server_error", type: "server_error", message: "Temporary failure" } }, { status: 503 });
    }
    return Response.json({ data: [{ b64_json: Buffer.from("real-image-bytes").toString("base64") }] });
  };

  try {
    const result = await loadGenerator()({
      merchant,
      title: "Notre nouveauté",
      caption: "Découvrez notre nouveauté.",
      format: "social",
      brandSettings: null,
      supabaseClient: supabase.client
    });
    assert.match(result.imageUrl, /^https:\/\/assets\.example\//);
    assert.equal(requests.length, 2);
    for (const body of requests) {
      assert.equal(body.model, "gpt-image-2");
      assert.equal(body.size, "1024x1024");
      assert.equal(body.quality, "medium");
      assert.equal(body.output_format, "png");
      assert.equal(body.n, 1);
    }
    assert.equal(supabase.uploads.length, 1);
    assert.match(supabase.uploads[0].path, /^owner\/social\//, "En accès CRM, le stockage appartient au commerce");
    assert.equal(supabase.uploads[0].bytes.toString(), "real-image-bytes");
    assert.equal(supabase.inserts.length, 1);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
    else process.env.OPENAI_IMAGE_MODEL = originalModel;
  }
});

test("Instagram — une erreur OpenAI permanente n'est pas transformée en faux succès", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const supabase = createSupabase();
  let calls = 0;
  process.env.OPENAI_API_KEY = "test-only";
  global.fetch = async () => {
    calls += 1;
    return Response.json({ error: { code: "content_policy_violation", type: "invalid_request_error", message: "Refus définitif" } }, { status: 400 });
  };

  try {
    await assert.rejects(loadGenerator()({
      merchant,
      title: "Test",
      caption: "Test",
      format: "social",
      brandSettings: null,
      supabaseClient: supabase.client
    }), /Refus définitif/);
    assert.equal(calls, 1);
    assert.equal(supabase.uploads.length, 0);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("Instagram — un échec d'image annule la création au lieu d'enregistrer un brouillon vide", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  let released = 0;
  let inserts = 0;
  delete process.env.OPENAI_API_KEY;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: () => {
      inserts += 1;
      return {};
    }
  };
  const { createSocialDraftFromIdea } = load("lib/social-drafts.ts", {
    "next/navigation": { redirect: () => assert.fail("Aucune redirection attendue") },
    "@/lib/story-editorial": {
      defaultStoryEditorial: () => ({}),
      normalizeStoryEditorial: (value) => value
    },
    "@/lib/social-recommendation-shared": { withRecommendationOrigin: (value) => value },
    "@/lib/social-recommendation-usage": {
      reserveSocialRecommendation: async () => ({ id: "reservation" }),
      releaseSocialRecommendationReservation: async () => { released += 1; },
      attachSocialRecommendationToPost: async () => assert.fail("Aucun post ne doit être associé")
    },
    "@/lib/brand-settings": { getBrandSettings: async () => null },
    "@/lib/social-builder": { renderBuilderStateToHtml: () => "" },
    "@/lib/social-editor/document": {
      createGeneratedDesignDocument: () => ({}),
      serializeDocumentToBuilderState: () => ({})
    },
    "@/lib/merchants": { getMerchant: async () => merchant },
    "@/lib/social-visuals": { composeAndStoreSocialPostVisual: async () => assert.fail("Aucune composition sans image") },
    "@/lib/hans-visual-source": { resolveHansVisual: async () => { throw new Error("provider detail"); } },
    "@/lib/merchant-media": { getMerchantMediaCategories: async () => [] },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client }
  });

  try {
    await assert.rejects(
      createSocialDraftFromIdea({ merchant, idea: { platform: "instagram", title: "Nouveauté", angle: "À découvrir" } }),
      /Hans n’a pas pu générer l’image/
    );
    assert.equal(inserts, 0);
    assert.equal(released, 1);
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
