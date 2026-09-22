import assert from "node:assert/strict";
import test from "node:test";

import { generateHansReviewReplyFallback } from "../lib/hans-review-reply-fallback.ts";

test("le repli personnalise un avis positif qui signale de l'attente", () => {
  const reply = generateHansReviewReplyFallback({
    reviewText: "Très bel institut, personnel agréable et soin vraiment top. J'enlève une étoile car mon rendez-vous a commencé avec environ 15 minutes de retard.",
    rating: 4,
    authorName: "Charlotte D.",
    merchantName: "Éclat Studio"
  });

  assert.match(reply, /Bonjour Charlotte D\./);
  assert.match(reply, /le soin/);
  assert.match(reply, /attente d’environ 15 minutes/);
  assert.match(reply, /L’équipe Éclat Studio/);
  assert.ok(reply.length < 400);
  assert.doesNotMatch(reply, /votre remarque nous aide à nous améliorer/);
});

test("le repli propose un contact pour un avis négatif", () => {
  const reply = generateHansReviewReplyFallback({
    reviewText: "Le soin était bien mais j'ai attendu presque 25 minutes sans explication.",
    rating: 2,
    authorName: "Julie L.",
    merchantName: "Éclat Studio"
  });

  assert.match(reply, /attente de presque 25 minutes/);
  assert.match(reply, /contact.*directement/);
  assert.ok(reply.length < 350);
});

test("le repli échappe les noms avant de produire le HTML", () => {
  const reply = generateHansReviewReplyFallback({
    reviewText: "Très bon accueil.",
    rating: 5,
    authorName: "<script>alert(1)</script>",
    merchantName: "A&B"
  });

  assert.doesNotMatch(reply, /<script>/);
  assert.match(reply, /&lt;script&gt;/);
  assert.match(reply, /A&amp;B/);
});
