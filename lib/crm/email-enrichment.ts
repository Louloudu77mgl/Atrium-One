import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const excludedExtensions = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/i;

function isPrivateIp(address: string) {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 0;
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function assertPublicUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("URL non autorisée");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Hôte non autorisé");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error("Hôte non public");
  return url;
}

async function safeFetch(rawUrl: string) {
  let url = await assertPublicUrl(rawUrl);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "AtriumOneCRM/1.0 (+public-contact-enrichment)", Accept: "text/html,application/xhtml+xml" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirection invalide");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("Contenu non HTML");
    return { html: (await response.text()).slice(0, 1_000_000), finalUrl: url };
  }
  throw new Error("Trop de redirections");
}

function extractEmails(html: string) {
  const decoded = html.replace(/&#64;|\[at\]|\(at\)/gi, "@").replace(/&#46;|\[dot\]|\(dot\)/gi, ".");
  return [...new Set((decoded.match(emailPattern) ?? []).map((email) => email.toLowerCase().replace(/^mailto:/, "")).filter((email) => !excludedExtensions.test(email) && !email.includes("example.com") && !email.includes("sentry.io")))];
}

function contactLinks(html: string, base: URL) {
  const result: string[] = [];
  const pattern = /href=["']([^"'#]+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (!/(contact|mentions|legal|impressum|coordonn)/i.test(href)) continue;
    try {
      const url = new URL(href, base);
      if (url.hostname === base.hostname && !result.includes(url.toString())) result.push(url.toString());
    } catch { /* URL relative invalide */ }
  }
  return result.slice(0, 3);
}

export async function enrichPublicEmail(website: string | null) {
  if (!website) return { email: null, source: "unavailable" as const, error: null };
  try {
    const initial = await safeFetch(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    const homepageEmails = extractEmails(initial.html);
    if (homepageEmails[0]) return { email: homepageEmails[0], source: "website" as const, error: null };
    for (const link of contactLinks(initial.html, initial.finalUrl)) {
      try {
        const page = await safeFetch(link);
        const emails = extractEmails(page.html);
        if (emails[0]) return { email: emails[0], source: "website" as const, error: null };
      } catch { /* Une page secondaire inaccessible ne bloque pas l’enrichissement. */ }
    }
    return { email: null, source: "unavailable" as const, error: null };
  } catch {
    return { email: null, source: "unavailable" as const, error: "Enrichissement indisponible" };
  }
}
