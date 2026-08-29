export const HANS_AUTOMATION_NODE_TYPES = [
  "new_customer",
  "new_visit",
  "new_reward",
  "google_review",
  "customer_returned",
  "customer_inactive",
  "customer_birthday",
  "registration_anniversary",
  "visit_milestone",
  "points_milestone",
  "profile_completed",
  "consent_granted",
  "game_participation",
  "game_reward_won",
  "reward_used",
  "near_reward",
  "visit_velocity",
  "review_by_rating",
  "review_keyword",
  "marketing_consent",
  "review_rating_gte",
  "reward_count",
  "visit_comparison",
  "last_visit_age",
  "points_comparison",
  "customer_status",
  "customer_contact_field",
  "review_rating_compare",
  "review_content",
  "review_status",
  "send_email",
  "generate_email",
  "prepare_instagram",
  "publish_instagram",
  "generate_review_reply",
  "publish_review_reply",
  "notify_merchant",
  "request_human_validation",
  "schedule_instagram",
  "stop_flow",
  "limit_once",
  "cooldown",
  "allowed_window"
] as const;

export type HansAutomationNodeType = (typeof HANS_AUTOMATION_NODE_TYPES)[number];
export type HansAutomationMode = "automatic" | "semi_automatic" | "draft_only";
export type HansAutomationBranch = "default" | "yes" | "no";

export type HansAutomationBlueprint = {
  title: string;
  summary: string;
  channel: string;
  understanding: string;
  assumptions: string[];
  warnings: string[];
  nodes: Array<{
    key: string;
    type: HansAutomationNodeType;
    title: string;
    config: Record<string, string | number | boolean>;
    mode?: HansAutomationMode;
  }>;
  edges: Array<{
    source: string;
    target: string;
    branch: HansAutomationBranch;
    label?: string;
  }>;
};

const nodeTypes = new Set<string>(HANS_AUTOMATION_NODE_TYPES);
const modes = new Set<string>(["automatic", "semi_automatic", "draft_only"]);
const branches = new Set<string>(["default", "yes", "no"]);

export function parseHansAutomationBlueprint(value: unknown): HansAutomationBlueprint {
  if (!isRecord(value)) throw new Error("Hans n’a pas retourné un scénario exploitable.");

  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  const rawEdges = Array.isArray(value.edges) ? value.edges : [];
  if (rawNodes.length < 2 || rawNodes.length > 14) throw new Error("Le scénario généré doit contenir entre 2 et 14 étapes.");
  if (rawEdges.length < 1 || rawEdges.length > 24) throw new Error("Les liaisons du scénario généré sont invalides.");

  const nodes = rawNodes.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`L’étape ${index + 1} est invalide.`);
    const type = cleanText(candidate.type, 60);
    if (!nodeTypes.has(type)) throw new Error(`Hans a proposé une étape indisponible : ${type || "inconnue"}.`);
    const mode = cleanText(candidate.mode, 30);
    return {
      key: cleanKey(candidate.key, `step_${index + 1}`),
      type: type as HansAutomationNodeType,
      title: cleanText(candidate.title, 100) || humanizeType(type),
      config: cleanConfig(candidate.config),
      ...(modes.has(mode) ? { mode: mode as HansAutomationMode } : {})
    };
  });

  const keys = new Set(nodes.map((node) => node.key));
  if (keys.size !== nodes.length) throw new Error("Hans a généré deux étapes avec le même identifiant.");
  if (nodes.filter((node) => isTrigger(node.type)).length !== 1) throw new Error("Le scénario généré doit contenir exactement un déclencheur.");

  const edges = rawEdges.map((candidate) => {
    if (!isRecord(candidate)) throw new Error("Une liaison du scénario est invalide.");
    const source = cleanKey(candidate.source, "");
    const target = cleanKey(candidate.target, "");
    const branch = cleanText(candidate.branch, 20) || "default";
    if (!keys.has(source) || !keys.has(target) || source === target || !branches.has(branch)) {
      throw new Error("Hans a généré une liaison incohérente entre deux étapes.");
    }
    const label = cleanText(candidate.label, 40);
    return { source, target, branch: branch as HansAutomationBranch, ...(label ? { label } : {}) };
  });

  return {
    title: cleanText(value.title, 100) || "Automatisation créée avec Hans",
    summary: cleanText(value.summary, 260) || "Hans a construit ce flow à partir de votre demande.",
    channel: cleanText(value.channel, 80) || "Automatisation",
    understanding: cleanText(value.understanding, 360) || cleanText(value.summary, 260),
    assumptions: cleanTextArray(value.assumptions, 4, 180),
    warnings: cleanTextArray(value.warnings, 4, 180),
    nodes,
    edges
  };
}

function isTrigger(type: HansAutomationNodeType) {
  return ["new_customer", "new_visit", "new_reward", "google_review", "customer_returned", "customer_inactive", "customer_birthday", "registration_anniversary", "visit_milestone", "points_milestone", "profile_completed", "consent_granted", "game_participation", "game_reward_won", "reward_used", "near_reward", "visit_velocity", "review_by_rating", "review_keyword"].includes(type);
}

function cleanConfig(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 12).flatMap(([key, candidate]) => {
    if (!["string", "number", "boolean"].includes(typeof candidate)) return [];
    const safeKey = cleanKey(key, "");
    if (!safeKey) return [];
    return [[safeKey, typeof candidate === "string" ? candidate.trim().slice(0, 500) : candidate]];
  })) as Record<string, string | number | boolean>;
}

function cleanTextArray(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanKey(value: unknown, fallback: string) {
  const key = cleanText(value, 80).toLocaleLowerCase("fr-FR").replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return key || fallback;
}

function humanizeType(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
