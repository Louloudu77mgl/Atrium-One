"use client";

export type AutomationStatus = "active" | "paused" | "draft" | "error" | "incomplete";
export type AutomationMode = "automatic" | "semi_automatic" | "draft_only";
export type AutomationSource = "template" | "manual" | "hans" | "existing";
export type AutomationView = "library" | "automations" | "workflow" | "history" | "logs" | "templates";
export type NodeCategory = "trigger" | "condition" | "action" | "delay" | "control";
export type EdgeBranch = "default" | "yes" | "no";

export type NodeFieldType = "text" | "number" | "boolean" | "select";

export type NodeField = {
  key: string;
  label: string;
  type: NodeFieldType;
  options?: string[];
};

export type NodeLibraryItem = {
  type: string;
  category: NodeCategory;
  title: string;
  description: string;
  icon: "alert" | "sparkle" | "mail" | "star" | "bell" | "chart" | "document" | "store" | "message" | "party" | "refresh" | "lock" | "phone" | "check" | "inbox" | "search" | "image" | "link";
  color: string;
  provider?: string;
  tags?: string[];
  fields: NodeField[];
  defaultConfig: Record<string, string | number | boolean>;
  defaultMode?: AutomationMode;
  branchLabels?: EdgeBranch[];
  availability?: "ready" | "planned";
  availabilityNote?: string;
};

export type AutomationNodeData = {
  id: string;
  type: string;
  category: NodeCategory;
  title: string;
  description: string;
  icon: NodeLibraryItem["icon"];
  color: string;
  x: number;
  y: number;
  width?: number;
  config: Record<string, string | number | boolean>;
  mode?: AutomationMode;
  status?: "idle" | "ready" | "warning" | "error";
};

export type AutomationEdge = {
  id: string;
  source: string;
  target: string;
  branch: EdgeBranch;
  label?: string;
};

export type ValidationIssue = {
  id: string;
  level: "error" | "warning";
  message: string;
  nodeId?: string;
  actionLabel?: string;
  actionHref?: string;
};

export type ExecutionStep = {
  id: string;
  nodeId: string;
  title: string;
  result: string;
  branch?: EdgeBranch;
  inputData?: Record<string, string | number | boolean | null>;
  outputData?: Record<string, string | number | boolean | null>;
};

export type ExecutionRecord = {
  id: string;
  createdAt: string;
  customerName: string;
  triggerLabel: string;
  status: "success" | "pending" | "failed" | "cancelled" | "validation_required";
  durationLabel: string;
  inputData?: Record<string, string | number | boolean | null>;
  outputData?: Record<string, string | number | boolean | null>;
  steps: ExecutionStep[];
};

export type AutomationFlow = {
  id: string;
  title: string;
  description: string;
  summary: string;
  channel: string;
  category?: string;
  installMinutes?: number;
  difficulty?: "Simple" | "Intermédiaire" | "Avancé";
  illustration?: string;
  status: AutomationStatus;
  source: AutomationSource;
  nodes: AutomationNodeData[];
  edges: AutomationEdge[];
  updatedAt: string;
  lastSavedLabel?: string;
  version: number;
  validationIssues: ValidationIssue[];
  executionHistory: ExecutionRecord[];
};

export type CanvasConnectionDraft = {
  sourceNodeId: string;
  branch: EdgeBranch;
} | null;

export type TestScenario = {
  customerName: string;
  visits: number;
  points: number;
  daysSinceLastVisit: number;
  rewards: number;
  marketingConsent: boolean;
  reviewRating: number;
  returnedAfterDelay: boolean;
};
