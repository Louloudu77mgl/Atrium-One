export type CrmNewsletterDraft = {
  title: string;
  summary: string;
  description: string;
  emailSubject: string;
  emailIntro: string;
};

const limits: Record<keyof CrmNewsletterDraft, number> = { title: 160, summary: 600, description: 5000, emailSubject: 180, emailIntro: 1000 };

export function parseNewsletterDraft(value: unknown): CrmNewsletterDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse IA invalide.");
  const result = {} as CrmNewsletterDraft;
  for (const key of Object.keys(limits) as Array<keyof CrmNewsletterDraft>) {
    const text = (value as Record<string, unknown>)[key];
    if (typeof text !== "string" || !text.trim() || text.trim().length > limits[key]) throw new Error("La newsletter générée est incomplète ou trop longue. Réessayez.");
    result[key] = text.trim();
  }
  return result;
}

export async function generateCrmNewsletter(prompt: string, signal?: AbortSignal): Promise<CrmNewsletterDraft> {
  if (!process.env.OPENAI_API_KEY) throw new Error("La génération IA n’est pas configurée.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.any([AbortSignal.timeout(75_000), ...(signal ? [signal] : [])]),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_EMAIL_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      store: false,
      max_output_tokens: 4000,
      instructions: "Tu rédiges les newsletters de l’équipe AtriumOne à ses utilisateurs, des commerces de proximité. Ce n’est pas une campagne d’un commerçant à ses propres clients. Interprète le brief et rédige en français un e-mail prêt à relire : objet, titre, résumé, introduction et corps en paragraphes. Ton chaleureux et professionnel. Utilise uniquement les faits fournis, sans inventer de nouveautés, prix, promotions ou dates. Ne recopie pas les consignes. Pas de HTML ni de Markdown : le CRM applique la mise en page AtriumOne. Le corps poursuit l’introduction sans la répéter et se termine par une signature de l’équipe AtriumOne. Le bouton Découvrir AtriumOne est ajouté automatiquement. N’affirme jamais que l’e-mail a été envoyé.",
      input: JSON.stringify({ brief: prompt }),
      text: { format: { type: "json_schema", name: "crm_newsletter", strict: true, schema: {
        type: "object", additionalProperties: false,
        required: Object.keys(limits),
        properties: Object.fromEntries(Object.entries(limits).map(([key, maxLength]) => [key, { type: "string", minLength: 1, maxLength }]))
      } } }
    })
  });
  if (!response.ok) throw new Error("La rédaction IA est indisponible. Réessayez dans un instant.");
  const result = await response.json();
  if (result.status !== "completed") throw new Error("La rédaction a été interrompue. Réessayez.");
  const text = result.output_text || result.output?.filter((item: { type: string }) => item.type === "message").flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content ?? []).filter((item: { type: string }) => item.type === "output_text").map((item: { text?: string }) => item.text ?? "").join("");
  return parseNewsletterDraft(JSON.parse(text || "null"));
}
