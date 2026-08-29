import type { ReviewSocialPostIdea } from "@/lib/review-insights";
import type { MerchantRow, SocialPostRow } from "@/lib/supabase/types";

type OpenAIResponseBody = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

type RawIdea = { title?: unknown; angle?: unknown; visualDirection?: unknown };

export async function generateFreshSocialIdeas({
  merchant,
  publishedPosts,
  existingIdeas,
  count
}: {
  merchant: MerchantRow;
  publishedPosts: SocialPostRow[];
  existingIdeas: ReviewSocialPostIdea[];
  count: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || count <= 0) return [];
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        instructions: [
          "Tu complètes une liste de recommandations Instagram pour un commerce local.",
          "Retourne uniquement un JSON valide {\"ideas\":[{\"title\":\"...\",\"angle\":\"...\",\"visualDirection\":\"...\"}]}.",
          "Propose des sujets nettement différents des publications exclues et des idées déjà retenues, pas seulement une reformulation.",
          "Varie aussi le langage visuel : macro, plan large, plongée, architecture, nature morte, mouvement, lumière et composition.",
          "N'invente aucune offre, aucun produit précis, aucune participation à un événement et aucune information factuelle absente.",
          "Chaque angle doit rester directement exploitable par le commerce."
        ].join(" "),
        input: JSON.stringify({
          merchant: { name: merchant.business_name, type: merchant.business_type, city: merchant.city, description: merchant.description },
          requestedCount: Math.min(10, count + 2),
          alreadyPublished: publishedPosts.slice(0, 60).map((post) => ({ title: post.title, caption: post.caption.slice(0, 220) })),
          alreadySelected: existingIdeas.map((idea) => ({ title: idea.title, angle: idea.angle }))
        }),
        max_output_tokens: 1_400
      }),
      cache: "no-store"
    });
    if (!response.ok) return [];
    const body = await response.json() as OpenAIResponseBody;
    const text = body.output_text?.trim() || body.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("").trim() || "";
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as { ideas?: RawIdea[] };
    return (parsed.ideas ?? []).flatMap((raw): ReviewSocialPostIdea[] => {
      const title = clean(raw.title, 90);
      const angle = clean(raw.angle, 260);
      const visualDirection = clean(raw.visualDirection, 220);
      return title && angle ? [{ platform: "instagram", title, angle, visualDirection, category: merchant.business_type }] : [];
    }).slice(0, Math.min(10, count + 2));
  } catch {
    return [];
  }
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}
