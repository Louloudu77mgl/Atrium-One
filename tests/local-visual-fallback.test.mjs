import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  createBrandedLocalVisualFallback,
  getLocalVisualDimensions,
  prepareFallbackPhoto
} from "../lib/local-visual-fallback.ts";

test("le repli visuel génère chaque format aux bonnes dimensions", async () => {
  for (const format of ["social", "story", "email", "rcu"]) {
    const buffer = await createBrandedLocalVisualFallback({
      format,
      primaryColor: "#4C1D95",
      secondaryColor: "#F3E8FF",
      accentColor: "#A855F7",
      seed: `test-${format}`
    });
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png");
    assert.deepEqual(
      { width: metadata.width, height: metadata.height },
      getLocalVisualDimensions(format)
    );
  }
});

test("le repli visuel neutralise les couleurs invalides", async () => {
  const buffer = await createBrandedLocalVisualFallback({
    format: "social",
    primaryColor: '"><script>alert(1)</script>',
    secondaryColor: "invalide",
    accentColor: null,
    seed: "couleurs-invalides"
  });
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
});

test("une photo de médiathèque est recadrée et teintée au format demandé", async () => {
  const source = await sharp({
    create: { width: 120, height: 80, channels: 3, background: "#E8D5C4" }
  }).jpeg().toBuffer();
  const result = await prepareFallbackPhoto({
    input: source,
    format: "email",
    primaryColor: "#4C1D95",
    accentColor: "#A855F7"
  });
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 1536);
  assert.equal(metadata.height, 1024);
});
