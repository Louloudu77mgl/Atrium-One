"use client";

import type { AutomationEdge, AutomationFlow, AutomationNodeData, ExecutionRecord, TestScenario, ValidationIssue } from "./types";

const supportedNodeTypes = new Set([
  "new_customer", "new_visit", "new_reward", "google_review",
  "marketing_consent", "review_rating_gte", "reward_count",
  "send_email", "generate_email", "prepare_instagram", "publish_instagram",
  "generate_review_reply", "publish_review_reply", "notify_merchant",
  "stop_flow", "limit_once"
]);
const reviewOnlyNodeTypes = new Set(["review_rating_gte", "generate_review_reply", "publish_review_reply"]);
const customerOnlyNodeTypes = new Set(["marketing_consent", "reward_count"]);

export function cloneFlow(flow: AutomationFlow): AutomationFlow {
  return JSON.parse(JSON.stringify(flow)) as AutomationFlow;
}

export function validateFlow(
  flow: AutomationFlow,
  capabilities: { instagramConnected: boolean; googleConnected: boolean; emailProviderReady: boolean; emailSubscribersCount: number }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
  const outgoing = countBy(flow.edges, "source");
  const incoming = countBy(flow.edges, "target");
  const triggers = flow.nodes.filter((node) => node.category === "trigger");

  if (!triggers.length) {
    issues.push({ id: "missing-trigger", level: "error", message: "Ajoutez au moins un déclencheur pour démarrer cette automatisation." });
  }
  if (triggers.length > 1) {
    issues.push({ id: "multiple-triggers", level: "error", message: "Un scénario doit avoir un seul déclencheur. Créez un second scénario pour l’autre événement." });
  }
  const triggerType = triggers[0]?.type;
  const hasInstagramPreparation = flow.nodes.some((node) => node.type === "prepare_instagram");
  const hasReviewReplyGeneration = flow.nodes.some((node) => node.type === "generate_review_reply");

  for (const node of flow.nodes) {
    if (!supportedNodeTypes.has(node.type)) {
      issues.push({ id: `unsupported-${node.id}`, level: "error", message: `La card « ${node.title} » appartient à une ancienne version et n’a pas d’exécution fiable. Remplacez-la par un bloc disponible dans la bibliothèque.`, nodeId: node.id });
    }
    if (triggerType === "google_review" && customerOnlyNodeTypes.has(node.type)) {
      issues.push({ id: `incompatible-review-${node.id}`, level: "error", message: `${node.title} nécessite un client RCU et ne peut pas suivre un avis Google.`, nodeId: node.id });
    }
    if (triggerType && triggerType !== "google_review" && reviewOnlyNodeTypes.has(node.type)) {
      issues.push({ id: `incompatible-customer-${node.id}`, level: "error", message: `${node.title} nécessite le déclencheur Nouvel avis Google.`, nodeId: node.id });
    }
    if (!incoming.get(node.id) && node.category !== "trigger") {
      issues.push({ id: `unlinked-in-${node.id}`, level: "error", message: `${node.title} n’est relié à aucune étape précédente.`, nodeId: node.id });
    }

    if (!outgoing.get(node.id) && node.category !== "action" && node.type !== "stop_flow") {
      issues.push({ id: `unlinked-out-${node.id}`, level: "warning", message: `${node.title} ne mène encore à aucune action.`, nodeId: node.id });
    }

    if (node.category === "condition") {
      const branches = flow.edges.filter((edge) => edge.source === node.id).map((edge) => edge.branch);
      if (!branches.includes("yes") || !branches.includes("no")) {
        issues.push({ id: `condition-branches-${node.id}`, level: "error", message: `${node.title} doit avoir une branche Oui et une branche Non.`, nodeId: node.id });
      }
    }

    if (node.type === "publish_instagram" && !capabilities.instagramConnected) {
      issues.push({ id: `instagram-${node.id}`, level: "error", message: "Instagram doit être connecté avant d’activer ce bloc.", nodeId: node.id, actionLabel: "Connecter Instagram", actionHref: "/social?connect=instagram" });
    }
    if (node.type === "publish_instagram" && !hasInstagramPreparation) {
      issues.push({ id: `instagram-source-${node.id}`, level: "error", message: "Ajoutez une card « Préparer une publication Instagram » avant de publier.", nodeId: node.id });
    }

    if ((node.type === "google_review" || node.type === "publish_review_reply") && !capabilities.googleConnected) {
      issues.push({ id: `google-${node.id}`, level: "error", message: "Google Business Profile doit être connecté avant d’activer ce bloc.", nodeId: node.id, actionLabel: "Connecter Google", actionHref: "/integrations" });
    }
    if (node.type === "google_review") {
      const interval = Number(node.config.interval_count);
      const unit = String(node.config.interval_unit ?? "");
      if (!Number.isFinite(interval) || interval < 1 || interval > 52) {
        issues.push({ id: `review-cadence-${node.id}`, level: "error", message: "La veille des avis doit être comprise entre 1 et 52 périodes.", nodeId: node.id });
      }
      if (!unit.startsWith("jour") && !unit.startsWith("semaine")) {
        issues.push({ id: `review-cadence-unit-${node.id}`, level: "error", message: "Choisissez une veille en jours ou en semaines.", nodeId: node.id });
      }
    }
    if (node.type === "publish_review_reply" && !hasReviewReplyGeneration) {
      issues.push({ id: `review-source-${node.id}`, level: "error", message: "Ajoutez une card « Générer une réponse à un avis » avant la publication Google.", nodeId: node.id });
    }

    if (["send_email", "send_newsletter", "prepare_newsletter", "generate_email"].includes(node.type)) {
      if (!capabilities.emailProviderReady) {
        issues.push({ id: `email-provider-${node.id}`, level: "error", message: "L’envoi d’e-mails doit être configuré avant d’activer ce bloc.", nodeId: node.id });
      } else if (capabilities.emailSubscribersCount === 0) {
        issues.push({ id: `email-audience-${node.id}`, level: "warning", message: "Aucun client e-mail consenti n’est disponible pour ce bloc.", nodeId: node.id });
      }
    }

    if (node.type === "wait_delay") {
      const value = Number(node.config.days ?? 0);
      if (!value || value < 0) {
        issues.push({ id: `delay-${node.id}`, level: "error", message: "Le délai doit être supérieur à 0.", nodeId: node.id });
      }
    }
  }

  if (hasCycle(flow.nodes, flow.edges)) {
    issues.push({ id: "cycle", level: "error", message: "Le flow crée une boucle infinie. Réorganisez ou retirez un lien." });
  }

  return issues;
}

export function autoLayout(flow: AutomationFlow): AutomationFlow {
  const next = cloneFlow(flow);
  const nodesById = new Map(next.nodes.map((node) => [node.id, node]));
  const levels = computeLevels(next.nodes, next.edges);
  const grouped = new Map<number, AutomationNodeData[]>();

  for (const node of next.nodes) {
    const level = levels.get(node.id) ?? 0;
    grouped.set(level, [...(grouped.get(level) ?? []), node]);
  }

  for (const [level, nodes] of grouped) {
    nodes.forEach((node, index) => {
      node.x = 120 + level * 390;
      node.y = 120 + index * 340;
      nodesById.set(node.id, node);
    });
  }

  next.updatedAt = new Date().toISOString();
  return next;
}

export function duplicateSelected(flow: AutomationFlow, selectedIds: string[]): AutomationFlow {
  const next = cloneFlow(flow);
  const selected = next.nodes.filter((node) => selectedIds.includes(node.id));
  const idMap = new Map<string, string>();
  const duplicated = selected.map((node) => {
    const newId = `${node.type}-${Math.random().toString(36).slice(2, 9)}`;
    idMap.set(node.id, newId);
    return { ...node, id: newId, x: node.x + 40, y: node.y + 40 };
  });
  const duplicatedEdges = next.edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({ ...edge, id: `edge-${idMap.get(edge.source)}-${idMap.get(edge.target)}-${edge.branch}`, source: idMap.get(edge.source)!, target: idMap.get(edge.target)! }));
  next.nodes.push(...duplicated);
  next.edges.push(...duplicatedEdges);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function removeNodesAndEdges(flow: AutomationFlow, selectedIds: string[]): AutomationFlow {
  const next = cloneFlow(flow);
  next.nodes = next.nodes.filter((node) => !selectedIds.includes(node.id));
  next.edges = next.edges.filter((edge) => !selectedIds.includes(edge.source) && !selectedIds.includes(edge.target));
  next.updatedAt = new Date().toISOString();
  return next;
}

export function buildExecutionPreview(flow: AutomationFlow, scenario: TestScenario): ExecutionRecord {
  const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
  const start = flow.nodes.find((node) => node.category === "trigger");
  const steps: ExecutionRecord["steps"] = [];
  const initialData: NonNullable<ExecutionRecord["inputData"]> = {
    client: scenario.customerName,
    visites: scenario.visits,
    recompenses: scenario.rewards,
    consentementMarketing: scenario.marketingConsent,
    noteAvis: scenario.reviewRating,
    retourApresDelai: scenario.returnedAfterDelay
  };
  let flowingData = { ...initialData };

  if (!start) {
    return {
      id: `run-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customerName: scenario.customerName,
      triggerLabel: "Aucun déclencheur",
      status: "failed",
      durationLabel: "0 s",
      inputData: initialData,
      outputData: { erreur: "Aucun déclencheur configuré" },
      steps: []
    };
  }

  let currentId: string | undefined = start.id;
  let guard = 0;

  while (currentId && guard < 20) {
    guard += 1;
    const node = nodesById.get(currentId);
    if (!node) break;

    let branch: "default" | "yes" | "no" = "default";
    let result = "Étape préparée";
    const inputData = { ...flowingData };

    if (node.category === "condition") {
      branch = evaluateCondition(node, scenario) ? "yes" : "no";
      result = branch === "yes" ? "Condition validée" : "Condition non validée";
    } else if (node.category === "delay") {
      result = `Attente simulée de ${node.config.days ?? 0} jour(s)`;
    } else if (node.category === "action") {
      result = node.mode === "automatic" ? "Action exécutée automatiquement" : node.mode === "semi_automatic" ? "Action préparée pour validation" : "Suggestion préparée";
    } else if (node.type === "stop_flow") {
      result = "Flow arrêté";
    }

    flowingData = {
      ...flowingData,
      derniereEtape: node.title,
      dernierResultat: result,
      ...(node.category === "condition" ? { brancheChoisie: branch === "yes" ? "Oui" : "Non" } : {})
    };

    steps.push({
      id: `step-${steps.length + 1}`,
      nodeId: node.id,
      title: node.title,
      result,
      branch: node.category === "condition" ? branch : undefined,
      inputData,
      outputData: { ...flowingData }
    });

    const nextEdge = flow.edges.find((edge) => edge.source === node.id && (node.category === "condition" ? edge.branch === branch : edge.branch === "default"));
    currentId = node.type === "stop_flow" ? undefined : nextEdge?.target;
  }

  return {
    id: `run-${Date.now()}`,
    createdAt: new Date().toISOString(),
    customerName: scenario.customerName,
    triggerLabel: start.title,
    status: steps.some((step) => step.result.includes("validation")) ? "validation_required" : "success",
    durationLabel: `${Math.max(1, steps.length * 2)} s`,
    inputData: initialData,
    outputData: flowingData,
    steps
  };
}

function evaluateCondition(node: AutomationNodeData, scenario: TestScenario) {
  switch (node.type) {
    case "marketing_consent":
      return scenario.marketingConsent;
    case "review_rating_gte":
      return scenario.reviewRating >= Number(node.config.rating ?? 4);
    case "reward_count":
      return scenario.rewards >= Number(node.config.count ?? 2);
    case "no_recent_message":
      return true;
    case "segment_match":
      return true;
    default:
      return true;
  }
}

function countBy(edges: AutomationEdge[], key: "source" | "target") {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge[key], (counts.get(edge[key]) ?? 0) + 1);
  }
  return counts;
}

function computeLevels(nodes: AutomationNodeData[], edges: AutomationEdge[]) {
  const levels = new Map<string, number>();
  const queue = nodes.filter((node) => node.category === "trigger").map((node) => ({ id: node.id, level: 0 }));

  while (queue.length) {
    const current = queue.shift()!;
    if ((levels.get(current.id) ?? -1) >= current.level) continue;
    levels.set(current.id, current.level);
    for (const edge of edges.filter((item) => item.source === current.id)) {
      queue.push({ id: edge.target, level: current.level + 1 });
    }
  }

  return levels;
}

function hasCycle(nodes: AutomationNodeData[], edges: AutomationEdge[]) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);

  function visit(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return nodes.some((node) => visit(node.id));
}
