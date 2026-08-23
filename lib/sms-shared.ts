import type { CustomerRow, MerchantRow } from "@/lib/supabase/types";

export type SmsTone = "chaleureux" | "premium" | "drôle" | "direct" | "élégant" | "familial";

export type CsvImportRow = {
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  opt_in_sms: boolean;
  opt_in_email: boolean;
  birthday: string | null;
  favorite_products: string[];
  notes: string | null;
  last_purchase_date: string | null;
  event_product_name: string | null;
};

const HEADER_SYNONYMS = {
  firstName: ["prenom", "prénom", "firstname", "first_name", "client", "client_prenom"],
  lastName: ["nom", "lastname", "last_name", "client_nom"],
  phone: ["telephone", "téléphone", "portable", "mobile", "phone", "gsm", "numero", "numéro"],
  phoneShort: ["tel", "tél"],
  email: ["email", "e_mail", "mail", "courriel", "adresse_mail", "adresse_email"],
  optIn: ["optin", "opt_in", "consentement", "accord_sms", "sms_ok", "autorisation_sms"],
  emailOptIn: ["opt_in_email", "optin_email", "consentement_email", "accord_email", "email_ok", "autorisation_email"],
  birthday: ["date_naissance", "date_de_naissance", "anniversaire", "birthday", "birth_date"],
  product: ["produit", "service", "prestation", "achat", "article", "produit_achete", "produit acheté", "favorite_products"],
  purchaseDate: ["date", "date_achat", "date achat", "last_purchase_date", "derniere_visite", "dernière visite", "visite"],
  notes: ["notes", "commentaire", "remarque", "memo", "mémo", "details", "détails"]
} as const;

export function normalizeFrenchPhone(rawValue: string | null | undefined) {
  const cleaned = (rawValue ?? "").replace(/[^\d+]/g, "");

  if (!cleaned) {
    return null;
  }

  if (/^(\+33|0033)[67]\d{8}$/.test(cleaned)) {
    return cleaned.replace(/^0033/, "+33");
  }

  if (/^0[67]\d{8}$/.test(cleaned)) {
    return `+33${cleaned.slice(1)}`;
  }

  return null;
}

export function estimateSmsParts(message: string) {
  const normalized = message.trim();
  const gsmBasic = /^[\r\n !#-\[\]-~€£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ"#$%&'()*+,\-.\/0-9:;<=>?@A-ZÄÖÑÜ§¿a-zäöñüà^{}\\\[~\]|]*$/u;
  const isGsm = gsmBasic.test(normalized);
  const singleLimit = isGsm ? 160 : 70;
  const multipartLimit = isGsm ? 153 : 67;
  const parts = normalized.length === 0 ? 0 : normalized.length <= singleLimit ? 1 : Math.ceil(normalized.length / multipartLimit);

  return {
    characters: normalized.length,
    parts
  };
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const delimiterScores = [
    { delimiter: ";", score: firstLine.split(";").length },
    { delimiter: ",", score: firstLine.split(",").length },
    { delimiter: "\t", score: firstLine.split("\t").length }
  ].sort((first, second) => second.score - first.score);

  return delimiterScores[0]?.delimiter ?? ";";
}

function parseCsv(text: string) {
  const sanitizedText = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(sanitizedText);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < sanitizedText.length; index += 1) {
    const character = sanitizedText[index];
    const nextCharacter = sanitizedText[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        currentCell += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && character === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell.trim());
      const hasMeaningfulData = currentRow.some((cell) => cell.length > 0);
      if (hasMeaningfulData) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  const [headers = [], ...dataRows] = rows;

  return {
    headers: headers.map(normalizeHeader),
    dataRows
  };
}

function findHeaderIndex(headers: string[], synonyms: readonly string[]) {
  return headers.findIndex((header) => synonyms.includes(header));
}

function parseBoolean(value: string | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return ["oui", "yes", "true", "1", "ok", "x"].includes(normalized);
}

function parseDate(value: string | undefined) {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return null;
  }

  const frenchMatch = normalized.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);

  if (frenchMatch) {
    const [, day, month, year] = frenchMatch;
    const isoYear = year.length === 2 ? `20${year}` : year;
    return new Date(`${isoYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T12:00:00Z`).toISOString();
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseCustomerCsv(text: string) {
  const { headers, dataRows } = parseCsv(text);
  const firstNameIndex = findHeaderIndex(headers, HEADER_SYNONYMS.firstName);
  const lastNameIndex = findHeaderIndex(headers, HEADER_SYNONYMS.lastName);
  const phoneIndex = findHeaderIndex(headers, HEADER_SYNONYMS.phone);
  const phoneShortIndex = phoneIndex >= 0 ? phoneIndex : findHeaderIndex(headers, HEADER_SYNONYMS.phoneShort);
  const optInIndex = findHeaderIndex(headers, HEADER_SYNONYMS.optIn);
  const emailOptInIndex = findHeaderIndex(headers, HEADER_SYNONYMS.emailOptIn);
  const birthdayIndex = findHeaderIndex(headers, HEADER_SYNONYMS.birthday);
  const emailIndex = findHeaderIndex(headers, HEADER_SYNONYMS.email);
  const productIndex = findHeaderIndex(headers, HEADER_SYNONYMS.product);
  const purchaseDateIndex = findHeaderIndex(headers, HEADER_SYNONYMS.purchaseDate);
  const notesIndex = findHeaderIndex(headers, HEADER_SYNONYMS.notes);

  if (firstNameIndex < 0 || lastNameIndex < 0 || emailIndex < 0) {
    return [];
  }

  const rows: CsvImportRow[] = [];

  dataRows.forEach((row) => {
    const phone = normalizeFrenchPhone((phoneIndex >= 0 ? row[phoneIndex] : phoneShortIndex >= 0 ? row[phoneShortIndex] : "") ?? "");

    const email = emailIndex >= 0 ? row[emailIndex]?.trim() || null : null;

    // L'import de la base clients est utilisable avec les trois colonnes
    // d'identification les plus courantes : prénom, nom et adresse e-mail.
    if (!email) {
      return;
    }

    const firstName = firstNameIndex >= 0 ? row[firstNameIndex] ?? "" : "";
    const lastName = lastNameIndex >= 0 ? row[lastNameIndex] ?? "" : "";
    const eventProduct = productIndex >= 0 ? row[productIndex] ?? "" : "";
    const notes = notesIndex >= 0 ? row[notesIndex] ?? "" : "";
    const optIn = optInIndex >= 0 ? parseBoolean(row[optInIndex]) : false;

    rows.push({
      first_name: firstName || "Client",
      last_name: lastName,
      phone,
      email,
      opt_in_sms: optIn,
      opt_in_email: emailOptInIndex >= 0 ? parseBoolean(row[emailOptInIndex]) : false,
      birthday: birthdayIndex >= 0 ? parseDate(row[birthdayIndex])?.slice(0, 10) ?? null : null,
      favorite_products: eventProduct ? [eventProduct] : [],
      notes: notes || null,
      last_purchase_date: purchaseDateIndex >= 0 ? parseDate(row[purchaseDateIndex]) : null,
      event_product_name: eventProduct || null
    });
  });

  return rows;
}

function formatRelativePurchaseDate(dateValue: string | null) {
  if (!dateValue) {
    return null;
  }

  const now = Date.now();
  const deltaDays = Math.max(1, Math.round((now - new Date(dateValue).getTime()) / (1000 * 60 * 60 * 24)));

  if (deltaDays < 10) {
    return "il y a quelques jours";
  }

  if (deltaDays < 45) {
    return `il y a ${Math.round(deltaDays / 7)} semaines`;
  }

  return `il y a ${Math.round(deltaDays / 30)} mois`;
}

function sanitizePersonalization(value: string | null | undefined) {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return null;
  }

  const forbiddenHints = ["grossesse", "religion", "ethnie", "origine", "orientation", "handicap", "politique"];

  if (forbiddenHints.some((hint) => normalized.toLowerCase().includes(hint))) {
    return null;
  }

  return normalized;
}

export function generatePersonalizedSms({
  customer,
  merchant,
  tone,
  objective,
  brandTone,
  commerceType
}: {
  customer: Pick<CustomerRow, "first_name" | "favorite_products" | "last_purchase_date" | "notes">;
  merchant?: MerchantRow | null;
  tone: SmsTone;
  objective: string;
  brandTone?: string | null;
  commerceType?: string | null;
}) {
  const name = customer.first_name?.trim() || "bonjour";
  const product = sanitizePersonalization(customer.favorite_products?.[0] ?? null);
  const note = sanitizePersonalization(customer.notes);
  const lastPurchase = formatRelativePurchaseDate(customer.last_purchase_date);
  const businessName = merchant?.business_name ?? "votre boutique";
  const type = (commerceType ?? merchant?.business_type ?? "commerce de proximité").toLowerCase();
  const toneLead = "Bonjour";
  const toneClose =
    tone === "premium"
      ? "Au plaisir de vous revoir"
      : tone === "drôle"
        ? "On vous garde une place"
        : tone === "direct"
          ? "Répondez-nous si cela vous intéresse"
          : "N’hésitez pas à revenir nous voir";

  let core = objective.trim() || "prendre des nouvelles";

  if (product && type.includes("coiff")) {
    core = `Nous repensions à votre ${product}${lastPurchase ? ` réalisée ${lastPurchase}` : ""}`;
  } else if (product && (type.includes("boulanger") || type.includes("patis"))) {
    core = `Votre ${product} a peut-être déjà manqué à vos pauses gourmandes`;
  } else if (product && type.includes("fleur")) {
    core = `Nous pensions à vos ${product}${lastPurchase ? ` choisies ${lastPurchase}` : ""}`;
  } else if (product) {
    core = `Nous repensions à votre ${product}${lastPurchase ? ` choisi ${lastPurchase}` : ""}`;
  } else if (lastPurchase) {
    core = `Votre dernière visite remonte à ${lastPurchase}`;
  }

  const noteSentence = note ? ` Nous avons aussi noté : ${note}.` : "";
  const brandSentence =
    brandTone === "premium"
      ? " Nous avons préparé une attention toute particulière pour vous."
      : brandTone === "convivial"
        ? " Toute l’équipe serait ravie de vous revoir."
        : "";
  const sms = `${toneLead} ${name} ! ${core}. ${objective}.${noteSentence}${brandSentence} ${toneClose} chez ${businessName}. STOP au 36180`;

  return sms
    .replace(/\s+/g, " ")
    .replace("..", ".")
    .trim();
}

export function buildSmsAudience(customers: CustomerRow[], audience: "all" | "recent" | "winback" | "vip" | "single", customerId?: string | null) {
  const smsReady = customers.filter((customer) => customer.opt_in_sms && !customer.sms_unsubscribed && Boolean(customer.phone));

  if (audience === "single") {
    return smsReady.filter((customer) => customer.id === customerId);
  }

  if (audience === "recent") {
    const now = Date.now();
    return smsReady.filter((customer) => {
      if (!customer.last_purchase_date) {
        return false;
      }
      const deltaDays = (now - new Date(customer.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24);
      return deltaDays <= 30;
    });
  }

  if (audience === "winback") {
    const now = Date.now();
    return smsReady.filter((customer) => {
      if (!customer.last_purchase_date) {
        return true;
      }
      const deltaDays = (now - new Date(customer.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24);
      return deltaDays >= 45;
    });
  }

  if (audience === "vip") {
    return smsReady.filter((customer) => customer.favorite_products.length >= 2 || (customer.notes ?? "").length > 18);
  }

  return smsReady;
}
