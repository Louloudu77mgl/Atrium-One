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
    return "la qualité du soin et de la prestation";
  }

  if (includesAny(review, ["accueil", "agreable", "gentil", "souriant", "chaleureu"])) {
    return "l’accueil et l’attention de l’équipe";
  }

  if (includesAny(review, ["equipe", "personnel", "conseil", "professionnel"])) {
    return "le professionnalisme de l’équipe";
  }

  if (includesAny(review, ["ambiance", "cadre", "institut", "salon", "boutique"])) {
    return "l’ambiance et le cadre";
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
    return "ce problème lié à votre rendez-vous";
  }

  if (includesAny(review, ["prix", "tarif", "cher", "couteux"])) {
    return "votre remarque sur le tarif";
  }

  if (includesAny(review, ["livraison", "livre", "commande"])) {
    return "ce problème de commande ou de livraison";
  }

  if (includesAny(review, ["accueil", "personnel", "equipe", "service"])) {
    return "votre déception concernant l’accueil ou le service";
  }

  return "le point d’amélioration que vous signalez";
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
        ? `<p>Merci beaucoup pour votre retour. Nous sommes ravis que ${positive} vous ait plu.</p>`
        : "<p>Merci beaucoup pour votre retour positif et pour votre confiance.</p>"
    );

    if (hasIssue) {
      paragraphs.push(`<p>Nous sommes toutefois désolés pour ${issue}. Ce n’est pas l’expérience fluide que nous souhaitons offrir, et votre remarque nous aide à nous améliorer.</p>`);
    }

    paragraphs.push("<p>Au plaisir de vous accueillir de nouveau dans de meilleures conditions.</p>");
  } else if (rating === 3) {
    paragraphs.push(`<p>Merci d’avoir pris le temps de partager votre expérience${positive ? ` et d’avoir souligné ${positive}` : ""}.</p>`);
    paragraphs.push(`<p>Nous sommes désolés pour ${issue}. Votre retour est précieux et nous allons en tenir compte pour vous offrir une expérience plus satisfaisante.</p>`);
    paragraphs.push("<p>Nous espérons avoir l’occasion de mieux vous accueillir lors d’une prochaine visite.</p>");
  } else {
    paragraphs.push("<p>Merci d’avoir pris le temps de nous faire part de votre expérience.</p>");
    paragraphs.push(`<p>Nous sommes sincèrement désolés pour ${issue}. Cette situation ne correspond pas au niveau de service que nous voulons offrir.</p>`);
    paragraphs.push("<p>Nous vous invitons à nous contacter directement afin que nous puissions échanger avec vous et trouver une solution adaptée.</p>");
  }

  paragraphs.push(`<p>L’équipe ${merchant}</p>`);
  return paragraphs.join("");
}
