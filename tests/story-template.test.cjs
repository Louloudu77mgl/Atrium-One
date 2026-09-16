const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { ImageResponse } = require("next/og");
const { load } = require("../scripts/emailing-test-loader.cjs");
const { buildStoryTemplate } = load("lib/story-template.ts");
const { normalizeStoryEditorial, defaultStoryEditorial, STORY_LAYOUTS } = load("lib/story-editorial.ts");

const content = {
  merchantName: "Maison Camille", title: "L’éclat, tout simplement.", cta: "Parlons de vos envies",
  edition: "septembre 2026", primary: "#514355", secondary: "#E9DDCC", accent: "#BD9C75",
  editorial: {
    eyebrow: "Les instants Maison", introduction: "Une pause pour vous. Un regard neuf sur les gestes qui prennent soin de vous.",
    photoBadge: "L’instant douceur", featureTitle: "Le soin commence ici",
    featureDescription: "Des textures délicates, des gestes précis et le plaisir de prendre son temps.",
    blocks: [{ label: "Notre regard", text: "La beauté dans les petits détails" }, { label: "À votre écoute", text: "Chaque envie mérite une attention" }]
  }
};

test("Stories — invalid model fields are replaced, not truncated or rendered as placeholders", () => {
  const fallback = defaultStoryEditorial("Notre actualité");
  const normalized = normalizeStoryEditorial({ eyebrow: "{{EYEBROW}}", introduction: "<script>x</script>", featureTitle: "X".repeat(200), photoBadge: "https://example.com", blocks: [null, { label: "Bienvenue", text: "Un moment pour vous" }, { text: "extra" }] }, fallback);
  assert.equal(normalized.eyebrow, fallback.eyebrow);
  assert.equal(normalized.introduction, fallback.introduction);
  assert.equal(normalized.featureTitle, fallback.featureTitle);
  assert.equal(normalized.photoBadge, fallback.photoBadge);
  assert.equal(normalized.blocks.length, 2);
  assert.equal(normalized.blocks[1].text, "Un moment pour vous");
});

test("Stories — three different layouts fit within Instagram safe areas", () => {
  const trees = STORY_LAYOUTS.map((layout) => buildStoryTemplate({ ...content, layout, photo: "data:image/png;base64,fixture" }));
  assert.equal(new Set(trees.map((tree) => JSON.stringify(tree))).size, 3);
  for (const tree of trees) {
    assert.equal(tree.props.style.width, 1080);
    assert.equal(tree.props.style.height, 1920);
    for (const child of tree.props.children) {
      const b = child.props.style;
      assert.ok(b.left >= 0 && b.left + b.width <= 1080);
      assert.ok(b.top >= 200 && b.top + b.height <= 1660);
      if (b.flexDirection === "column") {
        const lines = [].concat(child.props.children);
        assert.ok(lines.length * b.fontSize * 1.25 <= b.height);
      }
    }
  }
});

// Real offline rasterization: bundled Next font is portable in CI; local serif
// fonts provide a closer visual preview on macOS without any external API call.
test("Stories — render all three templates into valid 1080 × 1920 JPEGs", async () => {
  const bundled = path.dirname(require.resolve("next/package.json")) + "/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf";
  const font = (local) => fs.readFileSync(fs.existsSync(local) ? local : bundled);
  const fonts = [
    { name: "StoryBody", weight: 400, data: font("/System/Library/Fonts/Supplemental/Arial.ttf"), style: "normal" },
    { name: "StoryBody", weight: 700, data: font("/System/Library/Fonts/Supplemental/Arial Bold.ttf"), style: "normal" },
    { name: "StoryHeading", weight: 400, data: font("/System/Library/Fonts/Supplemental/Georgia.ttf"), style: "normal" }
  ];
  // Explicitly illustrative fixture, not a merchant photo.
  const fixture = await sharp(Buffer.from('<svg width="1000" height="800" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#C6AA86"/><stop offset="1" stop-color="#F4E7D7"/></linearGradient></defs><rect width="1000" height="800" fill="url(#b)"/><ellipse cx="500" cy="690" rx="300" ry="40" fill="#AD8D69" opacity=".3"/><rect x="290" y="240" width="160" height="430" rx="55" fill="#FCF8EF"/><rect x="315" y="200" width="110" height="80" rx="20" fill="#594B41"/><rect x="485" y="440" width="225" height="235" rx="50" fill="#DFCCC0"/><rect x="485" y="435" width="225" height="50" rx="18" fill="#786354"/><path d="M760 550Q650 280 880 100Q790 330 760 550" fill="#758474" opacity=".8"/></svg>')).png().toBuffer();
  const previews = [];
  for (const layout of STORY_LAYOUTS) {
    const tree = buildStoryTemplate({ ...content, layout, photo: `data:image/png;base64,${fixture.toString("base64")}` });
    const rendered = new ImageResponse(tree, { width: 1080, height: 1920, fonts });
    const jpeg = await sharp(Buffer.from(await rendered.arrayBuffer())).jpeg({ quality: 92 }).toBuffer();
    const metadata = await sharp(jpeg).metadata();
    assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1920); assert.equal(metadata.format, "jpeg");
    previews.push(await sharp(jpeg).resize(360, 640).toBuffer());
    if (process.env.STORY_QA_DIR) {
      fs.mkdirSync(process.env.STORY_QA_DIR, { recursive: true });
      fs.writeFileSync(path.join(process.env.STORY_QA_DIR, `${layout}.jpg`), jpeg);
    }
  }
  if (process.env.STORY_QA_DIR) await sharp({ create: { width: 1080, height: 640, channels: 3, background: "white" } }).composite(previews.map((input, index) => ({ input, left: index * 360, top: 0 }))).png().toFile(path.join(process.env.STORY_QA_DIR, "variants.png"));
});

test("Instagram — use live Business type even when stored type is missing and previous local check failed", async () => {
  const { getValidInstagramAccessToken } = load("lib/instagram-tokens.ts");
  const stored = { merchant_id: "merchant", status: "error", access_token_encrypted: "test-token", instagram_account_id: "ig-user", instagram_account_type: null, connected_at: new Date().toISOString(), token_expires_at: new Date(Date.now() + 30 * 86400000).toISOString() };
  const updates = [];
  const supabase = { from() { const query = { select() { return query; }, eq(key, value) { assert.equal(key, "merchant_id"); assert.equal(value, "merchant"); return query; }, async maybeSingle() { return { data: stored, error: null }; }, update(value) { updates.push(value); return query; } }; return query; } };
  const original = global.fetch;
  try {
    global.fetch = async () => Response.json({ user_id: "ig-user", username: "maison", account_type: "BUSINESS" });
    const result = await getValidInstagramAccessToken({ merchantId: "merchant", supabaseClient: supabase });
    assert.equal(result.connection.instagram_account_type, "BUSINESS");
    assert.equal(result.connection.status, "connected");
    assert.ok(updates.some((update) => update.status === "connected" && update.last_error === null));
    global.fetch = async () => Response.json({ user_id: "ig-user", username: "maison", account_type: "MEDIA_CREATOR" });
    const creator = await getValidInstagramAccessToken({ merchantId: "merchant", supabaseClient: supabase });
    assert.equal(creator.connection.instagram_account_type, "MEDIA_CREATOR");
  } finally { global.fetch = original; }
});

test("Stories — account restrictions, lost responses and terminal containers are safe to retry", async () => {
  const merchant = { id: "merchant" };
  const story = { id: "story", media_kind: "story", status: "publishing", caption: "", cta: "", hashtags: [], visual_url: "https://assets.example/story.jpg", meta_container_id: "existing" };
  const writes = [], connections = [], calls = [];
  let accountType = "MEDIA_CREATOR", graphResponse = {}, saveFails = false;
  const client = { from(table) { let value; const query = { update(next) { value = next; writes.push({ table, value }); return query; }, eq() { return query; }, select() { return query; }, async single() { return { data: { ...story, ...value }, error: null }; }, then(resolve) { return Promise.resolve({ error: saveFails && value?.meta_container_id ? { message: "database unavailable" } : null }).then(resolve); } }; return query; } };
  const { publishPostToInstagram } = load("lib/social-publish.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/crm/access": { assertBusinessFeatureAccessAdmin: async () => {} },
    "@/lib/instagram-tokens": { getValidInstagramAccessToken: async () => ({ accessToken: "test", connection: { instagram_account_id: "ig-user", instagram_account_type: accountType } }), markInstagramConnectionFailure: async (args) => connections.push(args) },
    "@/lib/social-editor/layout-safety": { validateDesignDocumentLayout: () => [] },
    "@/lib/social-editor/types": { isEditorDocument: () => false },
    "@/lib/social-post-utils": { canPublishSocialDesignToInstagram: () => true, getPublishableInstagramImageUrl: () => story.visual_url },
    "@/lib/social-recommendation-usage": { syncSocialRecommendationLifecycleForPost: async () => {} },
    "@/lib/supabase/server": {}
  });
  const original = global.fetch;
  try {
    global.fetch = async (url) => { calls.push(String(url)); return Response.json(graphResponse); };
    await assert.rejects(publishPostToInstagram({ merchant, post: story, supabaseClient: client }), /Business/);
    assert.equal(connections.length, 0); assert.equal(calls.length, 0);
    assert.equal(writes.at(-1).value.failure_code, "story_account_unsupported");
    accountType = "BUSINESS";
    for (const status of ["ERROR", "EXPIRED"]) {
      writes.length = 0; calls.length = 0;
      graphResponse = { status_code: status, status: "Media expired" };
      await assert.rejects(publishPostToInstagram({ merchant, post: story, supabaseClient: client }), /expired/);
      assert.equal(writes.at(-1).value.meta_container_id, null);
      assert.equal(calls.length, 1);
      assert.equal(connections.length, 0);
    }
    writes.length = 0;
    global.fetch = async () => { throw new Error("timeout"); };
    await assert.rejects(publishPostToInstagram({ merchant, post: story, supabaseClient: client }));
    assert.ok(writes.every(({ value }) => !("meta_container_id" in value)), "keep container after ambiguous failure");
    calls.length = 0; saveFails = true;
    global.fetch = async (url) => { calls.push(String(url)); return Response.json({ id: "new-container" }); };
    await assert.rejects(publishPostToInstagram({ merchant, post: { ...story, meta_container_id: null }, supabaseClient: client }), /Aucun envoi/);
    assert.equal(calls.length, 1); assert.ok(!calls[0].includes("media_publish"));
  } finally { global.fetch = original; }
});

test("Stories — immediate publish error returns the existing draft, not a failed generation", async () => {
  const story = { id: "same-story", status: "failed", error_message: "Meta unavailable" };
  let created = 0;
  const client = { auth: { getUser: async () => ({ data: { user: { id: "user" } } }) }, from() { const query = { select() { return query; }, eq() { return query; }, single: async () => ({ data: story }) }; return query; } };
  const { POST } = load("app/api/social/stories/route.ts", {
    "@/lib/merchants": { getMerchant: async () => ({ id: "merchant" }) },
    "@/lib/social-stories": { createInstagramStoryDraft: async () => { created += 1; return { ...story, status: "draft" }; } },
    "@/lib/social-publish": { publishPostToInstagram: async () => { throw new Error("Meta unavailable"); } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client }
  });
  const response = await POST(new Request("https://app.example/api/social/stories", { method: "POST", body: JSON.stringify({ idea: { title: "Notre actualité" }, publishNow: true }) }));
  const body = await response.json();
  assert.equal(response.status, 201); assert.equal(created, 1);
  assert.equal(body.story.id, "same-story"); assert.equal(body.publicationError, "Meta unavailable");
});

test("Hans — editorial blocks and merchant branding use the existing single generation call", async () => {
  const brand = { primary_color: "#514355", social_font_family: "Georgia" };
  const { generateDraftContent } = load("lib/social-drafts.ts", {
    "next/navigation": {}, "@/lib/social-recommendation-shared": {}, "@/lib/social-recommendation-usage": {},
    "@/lib/brand-settings": { getBrandSettings: async () => brand },
    "@/lib/social-builder": {}, "@/lib/social-editor/document": {}, "@/lib/merchants": {},
    "@/lib/social-visuals": {}, "@/lib/hans-visual-source": {}, "@/lib/supabase/server": {},
    "@/lib/merchant-media": { getMerchantMediaCategories: async () => [{ name: "Soins visage", description: "Les soins du commerce" }] }
  });
  const originalFetch = global.fetch, originalKey = process.env.OPENAI_API_KEY;
  const requests = [];
  try {
    process.env.OPENAI_API_KEY = "fixture";
    global.fetch = async (_url, request) => { requests.push(JSON.parse(request.body)); return Response.json({ output_text: JSON.stringify({ visualHook: content.title, storyEditorial: content.editorial, format: "carré", mediaCategory: "Soins visage" }) }); };
    const result = await generateDraftContent({ merchant: { id: "merchant", business_name: "Maison Camille" }, idea: { title: "Un soin du visage", contentType: "story" } });
    assert.equal(requests.length, 1);
    assert.match(requests[0].instructions, /storyEditorial/);
    assert.equal(JSON.parse(requests[0].input).brand.primary_color, brand.primary_color);
    assert.equal(result.draft.format, "story");
    assert.deepEqual(result.draft.storyEditorial, content.editorial);
    assert.equal(result.draft.mediaCategory, "Soins visage");
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  }
});
