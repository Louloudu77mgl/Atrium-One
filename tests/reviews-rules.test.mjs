import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cleanGoogleReviewText, getReviewSentimentFromRating, hasReviewComment, isNegativeRating } from "../lib/review-rules.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("la traduction anglaise Google est retirée de l'avis français", () => {
  assert.equal(
    cleanGoogleReviewText("Service impeccable.\n(Translated by Google)\nImpeccable service."),
    "Service impeccable."
  );
  assert.equal(
    cleanGoogleReviewText("(Translated by Google)\nImpeccable service.\n\n(Original)\nService impeccable."),
    "Service impeccable."
  );
  assert.equal(
    cleanGoogleReviewText("Great welcome\n\n(Avis d’origine) : Accueil formidable"),
    "Accueil formidable"
  );
  assert.equal(cleanGoogleReviewText("Très bon accueil"), "Très bon accueil");
  assert.equal(cleanGoogleReviewText("Concept original et accueil chaleureux"), "Concept original et accueil chaleureux");
});

test("les avis sans commentaire ne sont jamais éligibles à une réponse", () => {
  for (const value of [undefined, null, "", "   ", "Avis sans commentaire", "Sans commentaire.", "No comment"]) {
    assert.equal(hasReviewComment(value), false, String(value));
  }
  assert.equal(hasReviewComment("Très bon accueil"), true);

  const replyRoute = read("../app/api/hans/reply/route.ts");
  const automationRunner = read("../lib/review-automation-runner.ts");
  assert.match(replyRoute, /hasReviewComment\(reviewText\)/);
  assert.match(automationRunner, /hasReviewComment\(review\.comment\)/);
});

test("un avis est négatif si et seulement si sa note est comprise entre 1 et 3", () => {
  for (const rating of [1, 2, 3]) {
    assert.equal(isNegativeRating(rating), true, `${rating} étoiles`);
    assert.equal(getReviewSentimentFromRating(rating), "negatif");
  }
  for (const rating of [4, 5]) {
    assert.equal(isNegativeRating(rating), false, `${rating} étoiles`);
    assert.equal(getReviewSentimentFromRating(rating), "positif");
  }

  const reviewsPage = read("../app/reviews/ReviewsPageClient.tsx");
  assert.match(reviewsPage, /activeFilter === "negative"[\s\S]*isNegativeReview\(review\)/);
});
