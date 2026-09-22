type HansReviewReplyFallbackInput = {
  reviewText: string;
  rating: number;
  authorName?: string;
  merchantName?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function positiveDetail(review: string) {
  if (includesAny(review, ["soin", "prestation", "massage", "ongle", "visage"])) {
    return "le soin";
  }

  if (includesAny(review, ["accueil", "agreable", "gentil", "souriant", "chaleureu"])) {
    return "l’accueil";
  }

  if (includesAny(review, ["equipe", "personnel", "conseil", "professionnel"])) {
    return "l’équipe";
  }

  if (includesAny(review, ["ambiance", "cadre", "institut", "salon", "boutique"])) {
    return "l’ambiance";
  }

  return null;
}

function issueDetail(review: string, originalReview: string) {
  if (includesAny(review, ["attend", "retard", "patient", "minute", "heure"])) {
    const duration = originalReview.match(/\b(?:environ\s+|presque\s+)?\d{1,3}\s*(?:minutes?|mins?)\b/i)?.[0];
    if (duration) {
      const escapedDuration = escapeHtml(duration);
      return normalized(duration).startsWith("environ ")
        ? `cette attente d’${escapedDuration}`
        : `cette attente de ${escapedDuration}`;
    }
    return "ce temps d’attente";
  }

  if (includesAny(review, ["rendez-vous", "rendez vous", "rdv"])) {
    return "ce souci avec votre rendez-vous";
  }

  if (includesAny(review, ["prix", "tarif", "cher", "couteux"])) {
    return "votre déception concernant le tarif";
  }

  if (includesAny(review, ["livraison", "livre", "commande"])) {
    return "ce souci de commande ou de livraison";
  }

  if (includesAny(review, ["accueil", "personnel", "equipe", "service"])) {
    return "votre déception concernant l’accueil ou le service";
  }

  return "ce qui n’a pas été à la hauteur";
}

export function generateHansReviewReplyFallback({
  reviewText,
  rating,
  authorName,
  merchantName
}: HansReviewReplyFallbackInput) {
  const review = normalized(reviewText);
  const author = authorName?.trim() ? ` ${escapeHtml(authorName.trim())}` : "";
  const merchant = merchantName?.trim() && merchantName.trim() !== "votre boutique"
    ? escapeHtml(merchantName.trim())
    : "de votre boutique";
  const positive = positiveDetail(review);
  const issue = issueDetail(review, reviewText);
  const hasIssue = rating <= 3 || includesAny(review, ["mais", "dommage", "attend", "retard", "probleme", "decu", "etoile car"]);

  const paragraphs = [`<p>Bonjour${author},</p>`];

  if (rating >= 4) {
    paragraphs.push(
      positive
        ? `<p>Merci pour votre retour. Nous sommes ravis que ${positive} vous ait plu.</p>`
        : "<p>Merci beaucoup pour votre message. Ça nous fait très plaisir !</p>"
    );

    if (hasIssue) {
      paragraphs.push(`<p>Désolés pour ${issue}. Nous allons être plus attentifs à ce point.</p>`);
    }

    paragraphs.push(`<p>${hasIssue ? "Nous espérons vous revoir bientôt." : "À très bientôt !"}</p>`);
  } else if (rating === 3) {
    paragraphs.push(`<p>Merci pour votre retour${positive ? `. Nous sommes heureux que ${positive} vous ait plu` : ""}.</p>`);
    paragraphs.push(`<p>Désolés pour ${issue}. Nous allons être plus attentifs à ce point.</p>`);
  } else {
    paragraphs.push(`<p>Merci d’avoir pris le temps de nous écrire. Nous sommes vraiment désolés pour ${issue}.</p>`);
    paragraphs.push("<p>N’hésitez pas à nous contacter directement : nous aimerions en parler avec vous.</p>");
  }

  paragraphs.push(`<p>L’équipe ${merchant}</p>`);
  return paragraphs.join("");
}
