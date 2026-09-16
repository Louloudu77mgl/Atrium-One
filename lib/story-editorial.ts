export type StoryEditorial = {
  eyebrow: string;
  introduction: string;
  photoBadge: string;
  featureTitle: string;
  featureDescription: string;
  blocks: { label: string; text: string }[];
};

// Reject overlong model output instead of cutting a sentence in the image.
function text(value: unknown, fallback: string, max: number) {
  const cleaned = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return cleaned && cleaned.length <= max && !/\{\{|\}\}|<[^>]+>|https?:\/\//i.test(cleaned) ? cleaned : fallback;
}

export function normalizeStoryEditorial(raw: unknown, fallback: StoryEditorial): StoryEditorial {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  return {
    eyebrow: text(data.eyebrow, fallback.eyebrow, 26),
    introduction: text(data.introduction, fallback.introduction, 100),
    photoBadge: text(data.photoBadge, fallback.photoBadge, 24),
    featureTitle: text(data.featureTitle, fallback.featureTitle, 48),
    featureDescription: text(data.featureDescription, fallback.featureDescription, 110),
    blocks: fallback.blocks.slice(0, 2).map((block, index) => {
      const candidate = blocks[index] && typeof blocks[index] === "object" ? blocks[index] : {};
      return { label: text(candidate.label, block.label, 20), text: text(candidate.text, block.text, 64) };
    })
  };
}

export function defaultStoryEditorial(subtitle: string): StoryEditorial {
  return {
    eyebrow: "Le journal du commerce",
    introduction: text(subtitle, "Un regard sur notre savoir-faire et les détails qui font la différence.", 110),
    photoBadge: "À découvrir",
    featureTitle: "Le sens du détail",
    featureDescription: "Prenez le temps de découvrir notre univers et de nous poser vos questions.",
    blocks: [
      { label: "L’inspiration", text: "Un autre regard sur notre quotidien" },
      { label: "Rencontrons-nous", text: "Parlons de vos envies ensemble" }
    ]
  };
}

export type StoryLayout = "editorial" | "photo-first" | "split";
export const STORY_LAYOUTS: StoryLayout[] = ["editorial", "photo-first", "split"];
