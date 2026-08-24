"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import type { AutomationExecutionLog } from "@/lib/automation-execution-store";
import type { Review } from "@/lib/mock-data";
import type { ReviewCounters } from "@/lib/review-counters";
import type { GoogleConnectionRow, InstagramConnectionRow, MerchantAutomationSettingsRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";
import { AutomationCanvas } from "./automation-builder/AutomationCanvas";
import { AutomationHistory } from "./automation-builder/AutomationHistory";
import { AutomationTemplates } from "./automation-builder/AutomationTemplates";
import { AutomationToolbar } from "./automation-builder/AutomationToolbar";
import { HansFlowGenerator } from "./automation-builder/HansFlowGenerator";
import { NodeConfigPanel } from "./automation-builder/NodeConfigPanel";
import { NodeLibrary } from "./automation-builder/NodeLibrary";
import { TestFlowPanel } from "./automation-builder/TestFlowPanel";
import { autoLayout, buildExecutionPreview, cloneFlow, duplicateSelected, removeNodesAndEdges, validateFlow } from "./automation-builder/helpers";
import { buildTemplates, createNodeFromLibrary, NODE_LIBRARY } from "./automation-builder/templates";
import type { AutomationFlow, AutomationMode, AutomationStatus, AutomationView, CanvasConnectionDraft, ExecutionRecord, TestScenario } from "./automation-builder/types";

const shellCard = "rounded-[28px] border border-[#EBE6DF] bg-white shadow-[0_12px_32px_rgba(23,19,31,0.05)]";
const inputClass = "w-full rounded-[14px] border border-[#EBE6DF] bg-white px-4 py-3 text-sm text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0]";
const navTabs: Array<{ id: AutomationView; label: string }> = [
  { id: "library", label: "Bibliothèque" },
  { id: "automations", label: "Mes automatisations" },
  { id: "history", label: "Historique" },
  { id: "logs", label: "Logs" },
  { id: "templates", label: "Templates" }
];

export function AutomationsWorkspace({
  merchant,
  reviews,
  reviewCounters,
  googleConnection,
  instagramConnection,
  instagramConfigured,
  settings,
  automationRuns,
  socialPosts,
  emailSubscribersCount,
  emailCampaignsCount,
  emailProviderReady
}: {
  merchant?: MerchantRow | null;
  reviews: Review[];
  reviewCounters: ReviewCounters;
  googleConnection?: GoogleConnectionRow | null;
  instagramConnection?: InstagramConnectionRow | null;
  instagramConfigured: boolean;
  settings: MerchantAutomationSettingsRow | null;
  automationRuns: AutomationExecutionLog[];
  socialPosts: SocialPostRow[];
  emailSubscribersCount: number;
  emailCampaignsCount: number;
  emailProviderReady: boolean;
  savedFlag: string | null;
  errorMessage: string | null;
}) {
  const merchantId = merchant?.id ?? "demo";
  const storageKey = `atriumone:workflow-builder:${merchantId}`;
  const templates = useMemo(() => buildTemplates({ businessName: merchant?.business_name ?? "votre commerce" }), [merchant?.business_name]);
  const [view, setView] = useState<AutomationView>("library");
  const [automations, setAutomations] = useState<AutomationFlow[]>(() =>
    buildExistingAutomations({
      merchant,
      settings,
      automationRuns,
      reviews,
      reviewCounters,
      socialPosts,
      emailSubscribersCount,
      emailCampaignsCount,
      emailProviderReady,
      googleConnected: googleConnection?.status === "connected",
      instagramConnected: instagramConnection?.status === "connected",
      templates
    })
  );
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.78);
  const [pan, setPan] = useState({ x: 120, y: 60 });
  const [connectionDraft, setConnectionDraft] = useState<CanvasConnectionDraft>(null);
  const [past, setPast] = useState<AutomationFlow[]>([]);
  const [future, setFuture] = useState<AutomationFlow[]>([]);
  const [autosaveLabel, setAutosaveLabel] = useState("Sauvegarde automatique active");
  const [testOpen, setTestOpen] = useState(false);
  const [testScenario, setTestScenario] = useState<TestScenario>({ customerName: "Marie Dupont", visits: 8, rewards: 2, marketingConsent: true, reviewRating: 5, returnedAfterDelay: false });
  const [testResult, setTestResult] = useState<ReturnType<typeof buildExecutionPreview> | null>(null);
  const [hansPrompt, setHansPrompt] = useState("");
  const [hansSummary, setHansSummary] = useState<string | null>(null);
  const [toolbarFeedback, setToolbarFeedback] = useState<string | null>(null);
  const [historyFeedback, setHistoryFeedback] = useState<string | null>(null);
  const [favoriteTypes, setFavoriteTypes] = useState<string[]>([]);
  const [recentTypes, setRecentTypes] = useState<string[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState("Toutes");
  const [libraryOnlyPopular, setLibraryOnlyPopular] = useState(false);
  const [listMode, setListMode] = useState<"cards" | "list">("cards");
  const [createOpen, setCreateOpen] = useState(false);
  const [creationStep, setCreationStep] = useState<1 | 2 | 3>(1);
  const [creationMode, setCreationMode] = useState<"template" | "manual" | "hans">("template");
  const [creationTheme, setCreationTheme] = useState("Réseaux sociaux");

  const currentAutomation = useMemo(() => automations.find((item) => item.id === selectedAutomationId) ?? null, [automations, selectedAutomationId]);
  const currentIssues = currentAutomation?.validationIssues ?? [];
  const selectedNode = currentAutomation?.nodes.find((node) => selectedNodeIds.includes(node.id)) ?? null;
  const allHistory = useMemo(() => automations.flatMap((automation) => automation.executionHistory.map((run) => ({ ...run, automationId: automation.id, automationTitle: automation.title }))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [automations]);
  const selectedRun = allHistory.find((run) => run.id === selectedRunId) ?? null;
  const runNodeIds = selectedRun?.steps.map((step) => step.nodeId) ?? [];
  const logRows = useMemo(() => allHistory.map((run) => ({ id: run.id, date: run.createdAt, automationTitle: run.automationTitle, result: run.steps[run.steps.length - 1]?.result ?? "Exécution terminée", status: run.status, duration: run.durationLabel })), [allHistory]);
  const grouped = useMemo(() => groupAutomations(automations), [automations]);
  const capabilities = useMemo(() => ({
    instagramConnected: instagramConfigured && instagramConnection?.status === "connected",
    googleConnected: googleConnection?.status === "connected",
    emailProviderReady,
    emailSubscribersCount
  }), [emailProviderReady, emailSubscribersCount, googleConnection?.status, instagramConfigured, instagramConnection?.status]);
  const filteredTemplates = useMemo(() => templates.filter((template) => {
    const haystack = `${template.title} ${template.description} ${template.channel} ${template.category ?? ""}`.toLocaleLowerCase("fr-FR");
    const matchesSearch = !librarySearch.trim() || haystack.includes(librarySearch.trim().toLocaleLowerCase("fr-FR"));
    const matchesCategory = libraryCategory === "Toutes" || template.category === libraryCategory || template.channel === libraryCategory;
    const matchesPopular = !libraryOnlyPopular || ["Google", "Instagram", "E-mail"].includes(template.channel);
    return matchesSearch && matchesCategory && matchesPopular;
  }), [libraryCategory, libraryOnlyPopular, librarySearch, templates]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        automations?: AutomationFlow[];
        selectedAutomationId?: string | null;
        view?: AutomationView;
        favoriteTypes?: string[];
        recentTypes?: string[];
      };
      if (Array.isArray(parsed.automations)) {
        setAutomations((current) => [
          ...current.filter((automation) => automation.source === "existing"),
          ...parsed.automations!.filter((automation) => automation.source !== "existing")
        ]);
      }
      if (parsed.selectedAutomationId) setSelectedAutomationId(parsed.selectedAutomationId);
      if (parsed.view) setView(parsed.view);
      if (parsed.favoriteTypes) setFavoriteTypes(parsed.favoriteTypes);
      if (parsed.recentTypes) setRecentTypes(parsed.recentTypes);
    } catch {
      return;
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ automations, selectedAutomationId, view, favoriteTypes, recentTypes }));
    setAutosaveLabel(`Sauvegardé à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`);
  }, [automations, favoriteTypes, recentTypes, selectedAutomationId, storageKey, view]);

  useEffect(() => {
    if (view !== "workflow") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !createOpen && !testOpen) {
        setSelectedNodeIds([]);
        setView("automations");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [createOpen, testOpen, view]);

  function replaceCurrentAutomation(next: AutomationFlow, pushHistory = true) {
    if (!currentAutomation) return;
    if (pushHistory) {
      setPast((items) => [...items, cloneFlow(currentAutomation)]);
      setFuture([]);
    }
    setAutomations((items) => items.map((automation) => automation.id === currentAutomation.id ? {
      ...next,
      updatedAt: new Date().toISOString(),
      version: pushHistory ? currentAutomation.version + 1 : currentAutomation.version,
      lastSavedLabel: autosaveLabel
    } : automation));
  }

  function openWorkflow(flow: AutomationFlow) {
    const preparedFlow = hasCrowdedLayout(flow) ? autoLayout(flow) : flow;
    if (preparedFlow !== flow) {
      setAutomations((items) => items.map((item) => item.id === flow.id ? preparedFlow : item));
    }
    setSelectedAutomationId(preparedFlow.id);
    setSelectedNodeIds([]);
    setSelectedRunId(null);
    setConnectionDraft(null);
    setPan({ x: 100, y: 70 });
    setZoom(0.78);
    setToolbarFeedback(null);
    setView("workflow");
  }

  function createBlankAutomation(source: AutomationFlow["source"]) {
    const flow: AutomationFlow = {
      id: `automation-${Date.now()}`,
      title: source === "hans" ? "Nouvelle automatisation générée par Hans" : "Nouvelle automatisation",
      description: "Créez votre flow bloc par bloc.",
      summary: "Définissez quand cela arrive, ce que Hans doit vérifier, puis ce qu’il doit faire.",
      channel: creationTheme,
      category: creationTheme,
      difficulty: "Simple",
      installMinutes: 4,
      illustration: "gradient",
      status: "draft",
      source,
      nodes: [],
      edges: [],
      updatedAt: new Date().toISOString(),
      lastSavedLabel: "Brouillon prêt",
      version: 1,
      validationIssues: [],
      executionHistory: []
    };
    setAutomations((items) => [flow, ...items]);
    openWorkflow(flow);
    setCreateOpen(false);
  }

  function useTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const flow = cloneFlow(template);
    flow.id = `automation-${Date.now()}`;
    flow.source = "template";
    flow.status = "draft";
    flow.validationIssues = validateFlow(flow, capabilities);
    flow.lastSavedLabel = "Template prêt";
    setAutomations((items) => [flow, ...items]);
    openWorkflow(flow);
    setCreateOpen(false);
  }

  function addNode(type: string, x = 240, y = 180) {
    if (!currentAutomation) return;
    const item = NODE_LIBRARY.flatMap((group) => group.items).find((entry) => entry.type === type);
    if (!item) return;
    const next = cloneFlow(currentAutomation);
    next.nodes.push(createNodeFromLibrary(item, x, y));
    touchRecentType(type);
    replaceCurrentAutomation(next);
  }

  function touchRecentType(type: string) {
    setRecentTypes((items) => [type, ...items.filter((item) => item !== type)].slice(0, 8));
  }

  function toggleFavoriteType(type: string) {
    setFavoriteTypes((items) => items.includes(type) ? items.filter((item) => item !== type) : [...items, type]);
  }

  function selectNode(nodeId: string, multi: boolean) {
    setSelectedNodeIds((items) => multi ? (items.includes(nodeId) ? items.filter((id) => id !== nodeId) : [...items, nodeId]) : [nodeId]);
  }

  function moveNode(nodeId: string, x: number, y: number) {
    if (!currentAutomation) return;
    const next = cloneFlow(currentAutomation);
    next.nodes = next.nodes.map((node) => node.id === nodeId ? { ...node, x, y } : node);
    replaceCurrentAutomation(next, false);
  }

  function deleteNode(nodeId: string) {
    if (!currentAutomation) return;
    const next = removeNodesAndEdges(currentAutomation, [nodeId]);
    setSelectedNodeIds((items) => items.filter((id) => id !== nodeId));
    replaceCurrentAutomation(next);
  }

  function startConnect(nodeId: string, branch: "default" | "yes" | "no") {
    setConnectionDraft({ sourceNodeId: nodeId, branch });
  }

  function completeConnect(targetNodeId: string) {
    if (!currentAutomation || !connectionDraft || connectionDraft.sourceNodeId === targetNodeId) return;
    const next = cloneFlow(currentAutomation);
    next.edges = next.edges.filter((edge) => !(edge.source === connectionDraft.sourceNodeId && edge.branch === connectionDraft.branch));
    next.edges.push({
      id: `edge-${connectionDraft.sourceNodeId}-${targetNodeId}-${connectionDraft.branch}`,
      source: connectionDraft.sourceNodeId,
      target: targetNodeId,
      branch: connectionDraft.branch,
      label: connectionDraft.branch === "yes" ? "Oui" : connectionDraft.branch === "no" ? "Non" : undefined
    });
    setConnectionDraft(null);
    replaceCurrentAutomation(next);
  }

  function removeEdge(edgeId: string) {
    if (!currentAutomation) return;
    const next = cloneFlow(currentAutomation);
    next.edges = next.edges.filter((edge) => edge.id !== edgeId);
    replaceCurrentAutomation(next);
  }

  function updateNodeConfig(nodeId: string, key: string, value: string | number | boolean) {
    if (!currentAutomation) return;
    const next = cloneFlow(currentAutomation);
    next.nodes = next.nodes.map((node) => node.id === nodeId ? { ...node, config: { ...node.config, [key]: value } } : node);
    replaceCurrentAutomation(next);
  }

  function updateNodeMode(nodeId: string, value: AutomationMode | undefined) {
    if (!currentAutomation) return;
    const next = cloneFlow(currentAutomation);
    next.nodes = next.nodes.map((node) => node.id === nodeId ? { ...node, mode: value } : node);
    replaceCurrentAutomation(next);
  }

  async function activateCurrentFlow() {
    if (!currentAutomation) return;
    const next = cloneFlow(currentAutomation);
    next.validationIssues = validateFlow(currentAutomation, capabilities);
    next.status = next.validationIssues.some((issue) => issue.level === "error") ? "incomplete" : "active";
    setToolbarFeedback(next.status === "active" ? "Flow validé, activation en cours" : "Activation impossible : corrigez les erreurs signalées");
    replaceCurrentAutomation(next);

    if (next.status !== "active" || !next.nodes.some((node) => node.type === "google_review")) {
      return;
    }

    const hasReplyGeneration = next.nodes.some((node) => node.type === "generate_review_reply");

    if (!hasReplyGeneration) {
      return;
    }

    setAutosaveLabel("Activation serveur en cours...");

    try {
      const response = await fetch("/api/settings/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deriveReviewAutomationSettings(next),
          reviews_auto_reply_enabled: true
        })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Activation serveur impossible.");
      }
      setAutosaveLabel("Automatisation active côté serveur");
      setToolbarFeedback("Automatisation active côté serveur");
    } catch (error) {
      setAutomations((items) => items.map((automation) => automation.id === next.id ? { ...automation, status: "error" } : automation));
      setAutosaveLabel(error instanceof Error ? error.message : "Activation serveur impossible");
      setToolbarFeedback(error instanceof Error ? error.message : "Activation serveur impossible");
    }
  }

  function validateCurrentFlow() {
    if (!currentAutomation) return;
    const next = cloneFlow(currentAutomation);
    next.validationIssues = validateFlow(currentAutomation, capabilities);
    const errors = next.validationIssues.filter((issue) => issue.level === "error").length;
    const warnings = next.validationIssues.filter((issue) => issue.level === "warning").length;
    setToolbarFeedback(errors || warnings ? `${errors} erreur(s) · ${warnings} avertissement(s)` : "Flow vérifié : aucun problème détecté");
    replaceCurrentAutomation(next);
  }

  function runFlow() {
    if (!currentAutomation) return;
    const result = buildExecutionPreview(currentAutomation, testScenario);
    const next = cloneFlow(currentAutomation);
    next.executionHistory = [result, ...next.executionHistory].slice(0, 20);
    next.status = result.status === "failed" ? "error" : currentAutomation.status;
    setToolbarFeedback(`Simulation terminée : ${executionLabel(result.status)}`);
    replaceCurrentAutomation(next);
  }

  function runTest() {
    if (!currentAutomation) return;
    const result = buildExecutionPreview(currentAutomation, testScenario);
    setTestResult(result);
    const next = cloneFlow(currentAutomation);
    next.executionHistory = [result, ...next.executionHistory].slice(0, 20);
    replaceCurrentAutomation(next);
  }

  function duplicateSelection() {
    if (!currentAutomation || !selectedNodeIds.length) return;
    replaceCurrentAutomation(duplicateSelected(currentAutomation, selectedNodeIds));
    setToolbarFeedback(`${selectedNodeIds.length} card(s) dupliquée(s)`);
  }

  function deleteSelection() {
    if (!currentAutomation || !selectedNodeIds.length) return;
    replaceCurrentAutomation(removeNodesAndEdges(currentAutomation, selectedNodeIds));
    setToolbarFeedback(`${selectedNodeIds.length} card(s) supprimée(s)`);
    setSelectedNodeIds([]);
  }

  function undo() {
    if (!currentAutomation || !past.length) return;
    const previous = past[past.length - 1];
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [cloneFlow(currentAutomation), ...items]);
    setAutomations((items) => items.map((automation) => automation.id === currentAutomation.id ? previous : automation));
    setToolbarFeedback("Dernière modification annulée");
  }

  function redo() {
    if (!currentAutomation || !future.length) return;
    const nextFuture = future[0];
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, cloneFlow(currentAutomation)]);
    setAutomations((items) => items.map((automation) => automation.id === currentAutomation.id ? nextFuture : automation));
    setToolbarFeedback("Modification rétablie");
  }

  function generateWithHans() {
    const generated = buildHansFlow(hansPrompt, templates, creationTheme);
    setHansSummary(generated.summary);
    setAutomations((items) => [generated.flow, ...items.filter((item) => item.id !== generated.flow.id)]);
    openWorkflow(generated.flow);
    setCreateOpen(false);
  }

  function recenterCanvas() {
    setPan({ x: 120, y: 60 });
    setZoom(0.78);
    setToolbarFeedback("Vue recentrée");
  }

  function reorganizeCurrentFlow() {
    if (!currentAutomation) return;
    replaceCurrentAutomation(autoLayout(currentAutomation));
    setPan({ x: 100, y: 70 });
    setToolbarFeedback("Cards réorganisées et espacées");
  }

  function openCreationModal() {
    setCreationStep(1);
    setCreateOpen(true);
  }

  function openHansCreator() {
    setCreationMode("hans");
    setCreationStep(3);
    setHansSummary(null);
    setCreateOpen(true);
  }

  function runSelectedHistory(run: ExecutionRecord & { automationTitle?: string }) {
    const automation = automations.find((item) => item.title === run.automationTitle) ?? currentAutomation;
    if (!automation) return;
    setSelectedAutomationId(automation.id);
    setSelectedRunId(run.id);
    setView("history");
  }

  function selectHistoryRun(runId: string) {
    const run = allHistory.find((item) => item.id === runId);
    if (run?.automationId) setSelectedAutomationId(run.automationId);
    setSelectedRunId(runId);
  }

  async function toggleScenario(automationId: string) {
    const automation = automations.find((item) => item.id === automationId);
    if (!automation) return;

    const shouldEnable = automation.status !== "active";
    const issues = shouldEnable ? validateFlow(automation, capabilities) : [];
    if (shouldEnable && issues.some((issue) => issue.level === "error")) {
      setAutomations((items) => items.map((item) => item.id === automationId ? { ...item, status: "incomplete", validationIssues: issues } : item));
      setHistoryFeedback("Ce scénario doit être configuré avant de pouvoir être activé.");
      return;
    }

    const previousStatus = automation.status;
    setAutomations((items) => items.map((item) => item.id === automationId ? { ...item, status: shouldEnable ? "active" : "paused", validationIssues: issues } : item));
    setHistoryFeedback(shouldEnable ? "Scénario activé." : "Scénario désactivé.");

    try {
      await syncScenarioStatus(automation, shouldEnable);
    } catch (error) {
      setAutomations((items) => items.map((item) => item.id === automationId ? { ...item, status: previousStatus } : item));
      setHistoryFeedback(error instanceof Error ? error.message : "Impossible de modifier ce scénario.");
    }
  }

  async function deleteScenario(automationId: string) {
    const automation = automations.find((item) => item.id === automationId);
    if (!automation) return;
    if (!window.confirm(`Supprimer définitivement « ${automation.title} » de vos automatisations ?`)) return;

    try {
      if (automation.status === "active") await syncScenarioStatus(automation, false);
      setAutomations((items) => items.filter((item) => item.id !== automationId));
      if (selectedAutomationId === automationId) setSelectedAutomationId(null);
      if (selectedRun?.automationId === automationId) setSelectedRunId(null);
      setHistoryFeedback("Scénario supprimé.");
    } catch (error) {
      setHistoryFeedback(error instanceof Error ? error.message : "Impossible de supprimer ce scénario.");
    }
  }

  async function syncScenarioStatus(automation: AutomationFlow, enabled: boolean) {
    const hasReviews = automation.nodes.some((node) => node.type === "google_review");
    const hasInstagram = automation.nodes.some((node) => node.type === "publish_instagram");
    if (!hasReviews && !hasInstagram) return;

    const payload = hasReviews
      ? enabled
        ? { ...deriveReviewAutomationSettings(automation), reviews_auto_reply_enabled: true }
        : {
            reviews_auto_reply_enabled: false,
            review_automation_mode: "disabled",
            reviews_five_star_action: "disabled",
            reviews_four_star_action: "disabled",
            reviews_three_star_action: "disabled",
            reviews_one_two_star_action: "disabled",
            always_validate_negative_reviews: false,
            block_sensitive_reviews: false,
            sensitive_keywords: []
          }
      : {
          social_auto_publish_enabled: enabled
        };

    const response = await fetch("/api/settings/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "La modification n’a pas pu être enregistrée.");
  }

  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-6 pb-16">
      <section className={`${shellCard} p-7`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Automatisations</div>
            <h1 className="mt-2 text-[34px] font-extrabold tracking-[-0.05em] text-[#17131F]">Automatisez votre quotidien, tout en gardant la main.</h1>
            <p className="mt-3 text-[15px] leading-7 text-[#6E6A76]">
              Gagnez du temps sur vos avis, vos communications et votre relation client. Choisissez un modèle ou expliquez simplement votre besoin à Hans.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openCreationModal} className="rounded-[12px] bg-[#2B1A4A] px-5 py-3 text-sm font-semibold text-white">Nouvelle automatisation</button>
          </div>
        </div>
      </section>

      <nav className={`${shellCard} flex flex-wrap gap-2 p-3`}>
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`rounded-[12px] px-4 py-2.5 text-sm font-semibold ${view === tab.id ? "bg-[#2B1A4A] text-white" : "text-[#17131F] hover:bg-[#F6F3EF]"}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {view === "library" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <div className={`${shellCard} p-6`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Rechercher une automatisation" className={inputClass} />
                <select value={libraryCategory} onChange={(event) => setLibraryCategory(event.target.value)} className={`${inputClass} max-w-[220px]`}>
                  {["Toutes", "Marketing", "Instagram", "Google", "E-mail", "CRM"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <label className="flex items-center gap-3 rounded-[14px] bg-[#F6F3EF] px-4 py-3 text-sm font-medium text-[#17131F]">
                  <input type="checkbox" checked={libraryOnlyPopular} onChange={(event) => setLibraryOnlyPopular(event.target.checked)} />
                  Les plus populaires
                </label>
              </div>
            </div>
            <div className={`${shellCard} p-6`}>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Catégories</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Marketing", "Réseaux sociaux", "Avis Google", "Emails", "SMS", "CRM", "Administration", "Commerce", "Clients"].map((item) => (
                  <span key={item} className="rounded-full bg-[#F6F3EF] px-3 py-2 text-[12px] font-semibold text-[#17131F]">{item}</span>
                ))}
              </div>
            </div>
          </section>

          <AutomationTemplates templates={filteredTemplates} onUse={useTemplate} />
        </>
      ) : null}

      {view === "templates" ? <AutomationTemplates templates={templates} onUse={useTemplate} /> : null}

      {view === "automations" ? (
        <section className={`${shellCard} p-6`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Mes automatisations</div>
              <h2 className="mt-2 text-[24px] font-extrabold text-[#17131F]">Toutes vos automatisations au même endroit</h2>
              {historyFeedback ? <div className="mt-2 text-[12px] font-semibold text-[#6E4DE0]">{historyFeedback}</div> : null}
            </div>
            <div className="inline-flex rounded-full bg-[#F6F3EF] p-1">
              <button type="button" onClick={() => setListMode("cards")} className={`rounded-full px-4 py-2 text-sm font-semibold ${listMode === "cards" ? "bg-white text-[#17131F]" : "text-[#6E6A76]"}`}>Cartes</button>
              <button type="button" onClick={() => setListMode("list")} className={`rounded-full px-4 py-2 text-sm font-semibold ${listMode === "list" ? "bg-white text-[#17131F]" : "text-[#6E6A76]"}`}>Liste</button>
            </div>
          </div>

          {listMode === "cards" ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {automations.map((automation) => (
                <article key={automation.id} onClick={() => openWorkflow(automation)} className="cursor-pointer rounded-[24px] border border-[#EBE6DF] bg-[#FCFBF9] p-5 text-left transition hover:border-[#6E4DE0] hover:bg-[#FBF8FF]">
                  <div className="flex items-center justify-between gap-3">
                    <span className={statusBadge(automation.status)}>{statusLabel(automation.status)}</span>
                    <span className="text-[12px] font-semibold text-[#9A96A1]">{automation.channel}</span>
                  </div>
                  <h3 className="mt-4 text-[18px] font-extrabold text-[#17131F]">{automation.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#6E6A76]">{automation.summary}</p>
                  <div className="mt-4 grid gap-2 text-[12.5px] text-[#6E6A76]">
                    <div>Dernière exécution : <strong className="text-[#17131F]">{formatDateTime(automation.executionHistory[0]?.createdAt)}</strong></div>
                    <div>Prochaine exécution : <strong className="text-[#17131F]">{nextRunLabel(automation)}</strong></div>
                    <div>Nombre d’actions : <strong className="text-[#17131F]">{automation.executionHistory.reduce((count, run) => count + run.steps.length, 0)}</strong></div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#EBE6DF] pt-4">
                    <button type="button" onClick={(event) => { event.stopPropagation(); openWorkflow(automation); }} className="rounded-[10px] bg-[#2B1A4A] px-4 py-2 text-sm font-semibold text-white">Ouvrir</button>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#6E6A76]">{automation.status === "active" ? "Actif" : "Inactif"}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={automation.status === "active"}
                        aria-label={`${automation.status === "active" ? "Désactiver" : "Activer"} ${automation.title}`}
                        onClick={(event) => { event.stopPropagation(); void toggleScenario(automation.id); }}
                        className={`relative h-7 w-12 rounded-full transition ${automation.status === "active" ? "bg-[#6E4DE0]" : "bg-[#D8D2DF]"}`}
                      >
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${automation.status === "active" ? "left-6" : "left-1"}`} />
                      </button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); void deleteScenario(automation.id); }} className="rounded-[10px] border border-[#F1D5D0] px-3 py-2 text-[12px] font-semibold text-[#C2492F]">Supprimer</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-[#FBFAFD] text-[10px] font-black uppercase tracking-[0.09em] text-[#8B7AA8]">
                  <tr>
                    <th className="px-5 py-3">Nom</th>
                    <th className="px-4 py-3">État</th>
                    <th className="px-4 py-3">Dernière exécution</th>
                    <th className="px-4 py-3">Prochaine exécution</th>
                    <th className="px-4 py-3">Actions</th>
                    <th className="px-4 py-3">Gestion</th>
                    <th className="px-5 py-3">Ouvrir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEAF3]">
                  {automations.map((automation) => (
                    <tr key={automation.id} className="hover:bg-[#FBFAFD]">
                      <td className="px-5 py-4">
                        <div className="font-black text-[#211432]">{automation.title}</div>
                        <div className="mt-1 text-[11px] font-medium text-[#8B7AA8]">{automation.summary}</div>
                      </td>
                      <td className="px-4 py-4"><span className={statusBadge(automation.status)}>{statusLabel(automation.status)}</span></td>
                      <td className="px-4 py-4 text-sm text-[#6B617F]">{formatDateTime(automation.executionHistory[0]?.createdAt)}</td>
                      <td className="px-4 py-4 text-sm text-[#6B617F]">{nextRunLabel(automation)}</td>
                      <td className="px-4 py-4 font-black text-[#211432]">{automation.executionHistory.reduce((count, run) => count + run.steps.length, 0)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={automation.status === "active"}
                            aria-label={`${automation.status === "active" ? "Désactiver" : "Activer"} ${automation.title}`}
                            onClick={() => void toggleScenario(automation.id)}
                            className={`relative h-7 w-12 rounded-full transition ${automation.status === "active" ? "bg-[#6E4DE0]" : "bg-[#D8D2DF]"}`}
                          >
                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${automation.status === "active" ? "left-6" : "left-1"}`} />
                          </button>
                          <button type="button" onClick={() => void deleteScenario(automation.id)} className="rounded-[10px] border border-[#F1D5D0] px-3 py-2 text-[12px] font-semibold text-[#C2492F]">Supprimer</button>
                        </div>
                      </td>
                      <td className="px-5 py-4"><button type="button" onClick={() => openWorkflow(automation)} className="rounded-[10px] border border-[#EBE6DF] px-4 py-2 text-sm font-semibold text-[#17131F]">Ouvrir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {view === "workflow" ? (
        <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#F7F5F1]">
          <div className="flex min-h-[72px] items-center gap-4 border-b border-[#E7E2DB] bg-white px-4 lg:hidden">
            <button
              type="button"
              onClick={() => {
                setSelectedNodeIds([]);
                setView("automations");
              }}
              aria-label="Quitter le workflow"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E3DED7] bg-[#F8F6F2]"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="truncate text-[17px] font-extrabold text-[#17131F]">{currentAutomation?.title ?? "Workflow"}</div>
              <div className="text-[12px] text-[#6E6A76]">Consultation mobile</div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center p-4 lg:hidden">
            <div className={`${shellCard} max-w-lg p-6`}>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Mobile</div>
              <h2 className="mt-2 text-[22px] font-extrabold text-[#17131F]">Édition simplifiée sur petit écran</h2>
              <p className="mt-2 text-[14px] leading-6 text-[#6E6A76]">Sur mobile, vous pouvez consulter, activer et suivre les automatisations. L’édition visuelle complète est réservée aux écrans plus larges.</p>
            </div>
          </div>

          <div className="hidden min-h-0 flex-1 flex-col lg:flex">
            <AutomationToolbar
              title={currentAutomation?.title ?? "Workflow"}
              status={currentAutomation ? statusLabel(currentAutomation.status) : "Brouillon"}
              zoom={zoom}
              canUndo={past.length > 0}
              canRedo={future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onZoom={(delta) => setZoom((value) => Math.max(0.45, Math.min(1.8, Number((value + delta).toFixed(2)))))}
              onAutoLayout={reorganizeCurrentFlow}
              onValidate={validateCurrentFlow}
              onTest={() => setTestOpen(true)}
              onRun={runFlow}
              onHistory={() => setView("history")}
              onBack={() => {
                setSelectedNodeIds([]);
                setView("automations");
              }}
              onActivate={activateCurrentFlow}
              onRecenter={recenterCanvas}
              autosaveLabel={autosaveLabel}
              feedback={toolbarFeedback}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex w-[320px] shrink-0 flex-col border-r border-[#E7E2DB] bg-white">
                <div className="min-h-0 flex-1">
                  <NodeLibrary onAdd={(type) => addNode(type, 260, 200)} favorites={favoriteTypes} recentTypes={recentTypes} onToggleFavorite={toggleFavoriteType} />
                </div>
                <div className="shrink-0 border-t border-[#E7E2DB] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Créer avec Hans</div>
                  <button type="button" onClick={openHansCreator} className="mt-2 w-full rounded-[10px] bg-[#2B1A4A] px-4 py-2.5 text-sm font-semibold text-white">
                    Ouvrir Hans
                  </button>
                </div>
              </div>

              <div className="relative min-w-0 flex-1 overflow-hidden">
                <div className="absolute right-5 top-5 z-30 flex gap-2 rounded-[14px] border border-[#E7E2DB] bg-white/95 p-2 shadow-[0_8px_24px_rgba(23,19,31,0.08)] backdrop-blur">
                    <button type="button" onClick={duplicateSelection} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Dupliquer</button>
                    <button type="button" onClick={deleteSelection} className="rounded-[10px] border border-[#F1D5D0] px-3 py-2 text-sm font-semibold text-[#C2492F]">Supprimer</button>
                </div>

                <AutomationCanvas
                  flow={currentAutomation}
                  selectedIds={selectedNodeIds}
                  connectionDraft={connectionDraft}
                  zoom={zoom}
                  pan={pan}
                  runNodeIds={runNodeIds}
                  onSelectNode={selectNode}
                  onMoveNode={moveNode}
                  onDeleteNode={deleteNode}
                  onStartConnect={startConnect}
                  onCompleteConnect={completeConnect}
                  onRemoveEdge={removeEdge}
                  onDropNodeType={(type, world) => addNode(type, world.x, world.y)}
                  onPanChange={setPan}
                  onRecenter={recenterCanvas}
                  onZoomDelta={(delta) => setZoom((value) => Math.max(0.45, Math.min(1.8, Number((value + delta).toFixed(2)))))}
                  fillViewport
                />
              </div>

              {selectedNode ? (
                <div className="w-[360px] shrink-0 overflow-y-auto border-l border-[#E7E2DB] bg-[#F7F5F1] p-3">
                  <NodeConfigPanel
                    flow={currentAutomation}
                    selectedNode={selectedNode}
                    issues={currentIssues}
                    onChange={updateNodeConfig}
                    onModeChange={updateNodeMode}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {view === "history" ? (
        <>
          <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <AutomationHistory history={allHistory} selectedRunId={selectedRunId} onSelect={selectHistoryRun} />
            <div className={`${shellCard} p-6`}>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Traçabilité</div>
              {selectedRun ? (
                <>
                  <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[22px] font-extrabold text-[#17131F]">{selectedRun.customerName}</h2>
                      <p className="mt-1 text-[13px] leading-6 text-[#6E6A76]">{selectedRun.automationTitle} · {formatDateTime(selectedRun.createdAt)} · {selectedRun.durationLabel}</p>
                    </div>
                    <span className={statusBadge(mapExecutionStatus(selectedRun.status))}>{executionLabel(selectedRun.status)}</span>
                  </div>

                  <div className="mt-5 rounded-[20px] border border-[#E4DCF5] bg-[#FBF8FF] p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8B7AA8]">Données reçues au départ</div>
                    <DataFields data={selectedRun.inputData} emptyLabel={selectedRun.triggerLabel} />
                  </div>

                  <div className="mt-6 border-l-2 border-[#DDD3F3] pl-5">
                    {selectedRun.steps.map((step, index) => (
                      <div key={step.id} className="relative pb-5 last:pb-0">
                        <div className="absolute -left-[31px] top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#6E4DE0] text-[10px] font-bold text-white ring-4 ring-white">{index + 1}</div>
                        <div className="rounded-[20px] border border-[#EBE6DF] bg-[#FCFBF9] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[15px] font-extrabold text-[#17131F]">{step.title}</div>
                            {step.branch ? <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6E4DE0]">Branche {step.branch === "yes" ? "Oui" : step.branch === "no" ? "Non" : "suivante"}</span> : null}
                          </div>
                          <div className="mt-1 text-[13px] leading-6 text-[#6E6A76]">{step.result}</div>
                          <div className="mt-3 rounded-[14px] bg-white p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Données transmises à l’étape suivante</div>
                            <DataFields data={step.outputData} emptyLabel="Aucune donnée supplémentaire produite." compact />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[20px] bg-[#F1F8F3] p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#43845C]">Résultat final</div>
                    <DataFields data={selectedRun.outputData} emptyLabel={selectedRun.steps.at(-1)?.result ?? "Exécution terminée"} />
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-[20px] border border-dashed border-[#EBE6DF] bg-[#FCFBF9] p-5 text-[14px] leading-6 text-[#6E6A76]">
                  Sélectionnez une exécution pour voir les données reçues, leur chemin exact et le résultat de chaque étape.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {view === "logs" ? (
        <section className={`${shellCard} p-6`}>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Logs</div>
          <h2 className="mt-2 text-[24px] font-extrabold text-[#17131F]">Des logs simples, pensés pour un commerçant</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[#FBFAFD] text-[10px] font-black uppercase tracking-[0.09em] text-[#8B7AA8]">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-4 py-3">Automatisation</th>
                  <th className="px-4 py-3">Résultat</th>
                  <th className="px-4 py-3">Succès</th>
                  <th className="px-4 py-3">Temps</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEAF3]">
                {logRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FBFAFD]">
                    <td className="px-5 py-4 text-sm text-[#6B617F]">{formatDateTime(row.date)}</td>
                    <td className="px-4 py-4 font-black text-[#211432]">{row.automationTitle}</td>
                    <td className="px-4 py-4 text-sm text-[#6B617F]">{row.result}</td>
                    <td className="px-4 py-4"><span className={statusBadge(mapExecutionStatus(row.status))}>{executionLabel(row.status)}</span></td>
                    <td className="px-4 py-4 text-sm text-[#6B617F]">{row.duration}</td>
                    <td className="px-5 py-4"><button type="button" onClick={() => runSelectedHistory(allHistory.find((item) => item.id === row.id)!)} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Ouvrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <TestFlowPanel open={testOpen} scenario={testScenario} result={testResult} onScenarioChange={setTestScenario} onRun={runTest} onClose={() => setTestOpen(false)} />
      {createOpen ? (
        <CreateAutomationModal
          step={creationStep}
          mode={creationMode}
          theme={creationTheme}
          prompt={hansPrompt}
          summary={hansSummary}
          templates={templates}
          onClose={() => setCreateOpen(false)}
          onStepChange={setCreationStep}
          onModeChange={setCreationMode}
          onThemeChange={setCreationTheme}
          onPromptChange={setHansPrompt}
          onChooseTemplate={(templateId) => {
            setCreationMode("template");
            useTemplate(templateId);
          }}
          onCreate={() => {
            if (creationMode === "template") {
              useTemplate(filteredTemplates[0]?.id ?? templates[0].id);
            } else if (creationMode === "hans") {
              generateWithHans();
            } else {
              createBlankAutomation("manual");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function buildExistingAutomations({
  settings,
  automationRuns,
  reviews,
  reviewCounters,
  socialPosts,
  emailSubscribersCount,
  emailCampaignsCount,
  emailProviderReady,
  googleConnected,
  instagramConnected,
  templates
}: {
  merchant?: MerchantRow | null;
  settings: MerchantAutomationSettingsRow | null;
  automationRuns: AutomationExecutionLog[];
  reviews: Review[];
  reviewCounters: ReviewCounters;
  socialPosts: SocialPostRow[];
  emailSubscribersCount: number;
  emailCampaignsCount: number;
  emailProviderReady: boolean;
  googleConnected: boolean;
  instagramConnected: boolean;
  templates: AutomationFlow[];
}) {
  const reviewsTemplate = cloneFlow(templates.find((item) => item.id === "template-reviews") ?? templates[0]);
  reviewsTemplate.id = "existing-reviews";
  reviewsTemplate.source = "existing";
  reviewsTemplate.status = googleConnected
    ? settings?.reviews_auto_reply_enabled && settings.review_automation_mode !== "disabled" ? "active" : "draft"
    : "incomplete";
  reviewsTemplate.summary = `${reviewCounters.pending} avis à traiter, ${reviewCounters.answered} déjà publiés.`;

  const instagramTemplate = cloneFlow(templates.find((item) => item.id === "template-instagram") ?? templates[1]);
  instagramTemplate.id = "existing-instagram";
  instagramTemplate.source = "existing";
  instagramTemplate.status = instagramConnected ? (settings?.social_auto_publish_enabled ? "active" : "draft") : "incomplete";
  instagramTemplate.summary = settings?.social_auto_publish_enabled ? `${settings.social_posts_per_cycle ?? 1} publication(s) prévues toutes les ${settings.social_cycle_weeks ?? 1} semaine(s).` : "Hans peut préparer vos publications dès que vous activez le flow.";
  instagramTemplate.installMinutes = 4;

  const newsletterTemplate = cloneFlow(templates.find((item) => item.id === "template-newsletter") ?? templates[2]);
  newsletterTemplate.id = "existing-newsletter";
  newsletterTemplate.source = "existing";
  newsletterTemplate.status = emailProviderReady && emailSubscribersCount > 0 ? "draft" : "incomplete";
  newsletterTemplate.summary = `${emailSubscribersCount} contact(s) consenti(s) · ${emailCampaignsCount} campagne(s) déjà créées.`;
  newsletterTemplate.installMinutes = 5;

  const emptyHistory = [reviewsTemplate, instagramTemplate, newsletterTemplate].map((automation) => ({
    ...automation,
    executionHistory: automation.executionHistory.length ? automation.executionHistory : []
  }));

  emptyHistory[0].executionHistory = buildRealReviewHistory(reviews, automationRuns, emptyHistory[0]);

  if (socialPosts[0]?.updated_at) {
    emptyHistory[1].executionHistory = [{
      id: "seed-instagram-run",
      createdAt: socialPosts[0].updated_at,
      customerName: "Planning social",
      triggerLabel: "Nouvelle semaine",
      status: "success",
      durationLabel: "18 s",
      inputData: {
        declencheur: "Nouvelle semaine",
        publicationsPrevues: settings?.social_posts_per_cycle ?? 1
      },
      outputData: {
        resultat: "Publications préparées et transmises pour validation"
      },
      steps: [
        { id: "seed-ig-1", nodeId: emptyHistory[1].nodes[0]?.id ?? "trigger", title: "Nouvelle semaine", result: "Planning lancé" },
        { id: "seed-ig-2", nodeId: emptyHistory[1].nodes[1]?.id ?? "action", title: "Hans génère une idée", result: "Deux idées générées" },
        { id: "seed-ig-3", nodeId: emptyHistory[1].nodes[4]?.id ?? "action", title: "Validation du commerçant", result: "Validation reçue" }
      ]
    }];
  }

  return emptyHistory;
}

function buildRealReviewHistory(
  reviews: Review[],
  automationRuns: AutomationExecutionLog[],
  automation: AutomationFlow
): ExecutionRecord[] {
  const loggedReviewIds = new Set(automationRuns.map((run) => run.local_review_id).filter(Boolean));
  const triggerNode = automation.nodes.find((node) => node.type === "google_review")?.id ?? "google-review-trigger";
  const generateNode = automation.nodes.find((node) => node.type === "generate_review_reply")?.id ?? "google-review-generate";
  const publishNode = automation.nodes.find((node) => node.type === "publish_review_reply")?.id ?? "google-review-publish";

  const storedRuns: ExecutionRecord[] = automationRuns.map((run) => ({
    id: run.id,
    createdAt: run.created_at,
    customerName: run.customer_name ?? "Contrôle automatique Google",
    triggerLabel: run.review_name ? "Nouvel avis Google" : "Contrôle automatique des avis",
    status: run.status === "published" ? "success" : run.status === "drafted" ? "validation_required" : run.status === "error" ? "failed" : "cancelled",
    durationLabel: "Temps réel",
    inputData: {
      client: run.customer_name ?? "Non renseigné",
      noteAvis: run.rating ?? null,
      identifiantAvis: run.review_name ?? null
    },
    outputData: {
      resultat: run.message,
      publicationGoogle: run.status === "published"
    },
    steps: buildStoredRunSteps(run, triggerNode, generateNode, publishNode)
  }));

  const reviewRuns: ExecutionRecord[] = reviews
    .filter((review) => !loggedReviewIds.has(review.id))
    .map((review) => {
      const published = review.status === "repondu"
        || ["published", "published_auto", "published_manual"].includes(review.generatedReplyStatus ?? "");
      const generated = Boolean(review.generatedReplyId || review.generatedReply);
      const createdAt = review.replyCreatedAt ?? review.updatedAt ?? review.createdAt ?? new Date().toISOString();
      const steps: ExecutionRecord["steps"] = [
        { id: `${review.id}-detected`, nodeId: triggerNode, title: "Nouvel avis Google", result: "Avis réellement importé dans AtriumOne" }
      ];

      if (generated) {
        steps.push({ id: `${review.id}-generated`, nodeId: generateNode, title: "Hans génère une réponse", result: "Réponse réellement enregistrée" });
      }
      if (published) {
        steps.push({ id: `${review.id}-published`, nodeId: publishNode, title: "Publication Google", result: "Réponse acceptée et publiée par Google" });
      }

      return {
        id: `review-${review.id}`,
        createdAt,
        customerName: review.author || "Client Google",
        triggerLabel: "Nouvel avis Google",
        status: published ? "success" : generated ? "validation_required" : "pending",
        durationLabel: published ? "Exécution terminée" : "En cours",
        inputData: { client: review.author, noteAvis: review.rating, avis: review.text || "Avis sans commentaire" },
        outputData: {
          resultat: published ? "Réponse publiée sur Google" : generated ? "Réponse en attente de validation" : "Avis détecté, réponse non générée",
          publicationGoogle: published
        },
        steps
      };
    });

  return [...storedRuns, ...reviewRuns]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 30);
}

function buildStoredRunSteps(
  run: AutomationExecutionLog,
  triggerNode: string,
  generateNode: string,
  publishNode: string
): ExecutionRecord["steps"] {
  if (!run.review_name) {
    return [{ id: `${run.id}-check`, nodeId: triggerNode, title: "Contrôle Google", result: run.message }];
  }

  const steps: ExecutionRecord["steps"] = [
    { id: `${run.id}-detected`, nodeId: triggerNode, title: "Nouvel avis Google", result: "Avis détecté par le runner serveur" }
  ];
  if (run.status !== "skipped") {
    steps.push({ id: `${run.id}-generated`, nodeId: generateNode, title: "Hans génère une réponse", result: run.status === "error" ? "Étape lancée avant l’erreur" : "Réponse générée" });
  }
  if (run.status === "published" || run.status === "error") {
    steps.push({ id: `${run.id}-publish`, nodeId: publishNode, title: "Publication Google", result: run.message });
  }
  return steps;
}

function buildHansFlow(prompt: string, templates: AutomationFlow[], theme: string) {
  const normalized = prompt.toLocaleLowerCase("fr-FR");
  let flow = cloneFlow(templates[0]);
  if (normalized.includes("instagram") || theme === "Réseaux sociaux") flow = cloneFlow(templates.find((item) => item.id === "template-instagram") ?? templates[0]);
  else if (normalized.includes("newsletter") || theme === "Emails") flow = cloneFlow(templates.find((item) => item.id === "template-newsletter") ?? templates[0]);
  else if (normalized.includes("avis") || theme === "Avis") flow = cloneFlow(templates.find((item) => item.id === "template-reviews") ?? templates[0]);
  else if (normalized.includes("30 jours") || normalized.includes("revenu")) flow = cloneFlow(templates.find((item) => item.id === "template-reactivation") ?? templates[0]);

  flow.id = `automation-${Date.now()}`;
  flow.source = "hans";
  flow.status = "draft";
  flow.summary = normalized.includes("sans mon accord")
    ? "Hans prépare le contenu, mais garde toujours la main au commerçant avant publication."
    : normalized.includes("mensuelle")
      ? "Chaque mois, Hans prépare l’automatisation demandée puis vous laisse valider."
      : "Hans a généré un flow complet, prêt à être relu puis activé.";
  return { flow, summary: flow.summary };
}

function groupAutomations(automations: AutomationFlow[]) {
  return {
    active: automations.filter((item) => item.status === "active"),
    paused: automations.filter((item) => item.status === "paused"),
    draft: automations.filter((item) => item.status === "draft"),
    error: automations.filter((item) => item.status === "error"),
    incomplete: automations.filter((item) => item.status === "incomplete")
  };
}

function deriveReviewAutomationSettings(flow: AutomationFlow) {
  const actions = new Map<number, "disabled" | "validation" | "automatic">(
    [1, 2, 3, 4, 5].map((rating) => [rating, resolveReviewActionForRating(flow, rating)])
  );
  const configuredActions = [...actions.values()];
  const hasAutomaticAction = configuredActions.includes("automatic");
  const hasValidationAction = configuredActions.includes("validation");

  return {
    review_automation_mode: hasAutomaticAction ? "automatic_guarded" as const : hasValidationAction ? "semi_automatic" as const : "disabled" as const,
    reviews_five_star_action: actions.get(5) ?? "disabled",
    reviews_four_star_action: actions.get(4) ?? "disabled",
    reviews_three_star_action: actions.get(3) ?? "disabled",
    reviews_one_two_star_action: actions.get(2) === actions.get(1) ? actions.get(2) ?? "disabled" : "disabled",
    always_validate_negative_reviews: false,
    block_sensitive_reviews: false,
    sensitive_keywords: [] as string[]
  };
}

function resolveReviewActionForRating(flow: AutomationFlow, rating: number): "disabled" | "validation" | "automatic" {
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  let current = flow.nodes.find((node) => node.type === "google_review");
  let requiresValidation = false;
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    if (current.type === "stop_flow") return "disabled";
    if (current.category === "action" && current.mode !== "automatic") requiresValidation = true;
    if (current.type === "publish_review_reply") {
      return current.mode === "automatic" && !requiresValidation ? "automatic" : "validation";
    }

    let branch: "default" | "yes" | "no" = "default";
    if (current.type === "review_rating_gte") {
      branch = rating >= Number(current.config.rating ?? 4) ? "yes" : "no";
    }

    const nextEdge = flow.edges.find((edge) => edge.source === current?.id && edge.branch === branch);
    current = nextEdge ? nodes.get(nextEdge.target) : undefined;
  }

  return requiresValidation ? "validation" : "disabled";
}

function nextRunLabel(automation: AutomationFlow) {
  if (automation.title.includes("Instagram")) return "Lundi prochain · 09:00";
  if (automation.title.includes("Newsletter")) return "Mois prochain · 10:00";
  if (automation.title.includes("avis")) return "À l’arrivée du prochain avis";
  return "À définir";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Aucune";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function statusLabel(status: AutomationStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "En pause";
    case "draft":
      return "Brouillon";
    case "error":
      return "Erreur";
    case "incomplete":
      return "Configuration incomplète";
  }
}

function statusBadge(status: AutomationStatus) {
  switch (status) {
    case "active":
      return "inline-flex rounded-full bg-[#EAF7EE] px-2.5 py-1 text-[11px] font-semibold text-[#2E9E5B]";
    case "paused":
      return "inline-flex rounded-full bg-[#FBF0E1] px-2.5 py-1 text-[11px] font-semibold text-[#9A5A16]";
    case "draft":
      return "inline-flex rounded-full bg-[#F2F1F6] px-2.5 py-1 text-[11px] font-semibold text-[#6E6A76]";
    case "error":
      return "inline-flex rounded-full bg-[#FBEAEA] px-2.5 py-1 text-[11px] font-semibold text-[#D64545]";
    case "incomplete":
      return "inline-flex rounded-full bg-[#FFF5F2] px-2.5 py-1 text-[11px] font-semibold text-[#C2492F]";
  }
}

function executionLabel(status: ExecutionRecord["status"]) {
  switch (status) {
    case "success":
      return "Succès";
    case "pending":
      return "En attente";
    case "failed":
      return "Erreur";
    case "cancelled":
      return "Annulé";
    case "validation_required":
      return "Validation requise";
  }
}

function mapExecutionStatus(status: ExecutionRecord["status"]): AutomationStatus {
  switch (status) {
    case "success":
      return "active";
    case "pending":
      return "paused";
    case "failed":
      return "error";
    case "cancelled":
      return "draft";
    case "validation_required":
      return "incomplete";
  }
}

function DataFields({
  data,
  emptyLabel,
  compact = false
}: {
  data?: Record<string, string | number | boolean | null>;
  emptyLabel: string;
  compact?: boolean;
}) {
  const entries = Object.entries(data ?? {});
  if (!entries.length) return <div className="mt-2 text-[12.5px] text-[#6E6A76]">{emptyLabel}</div>;

  return (
    <dl className={`mt-3 grid ${compact ? "gap-1.5" : "gap-2 sm:grid-cols-2"}`}>
      {entries.map(([key, value]) => (
        <div key={key} className={`flex gap-2 ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}>
          <dt className="font-semibold text-[#6E6A76]">{formatDataKey(key)} :</dt>
          <dd className="min-w-0 break-words font-semibold text-[#17131F]">{formatDataValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatDataKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}

function formatDataValue(value: string | number | boolean | null) {
  if (value === null) return "Non renseigné";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value);
}

function CreateAutomationModal({
  step,
  mode,
  theme,
  prompt,
  summary,
  templates,
  onClose,
  onStepChange,
  onModeChange,
  onThemeChange,
  onPromptChange,
  onChooseTemplate,
  onCreate
}: {
  step: 1 | 2 | 3;
  mode: "template" | "manual" | "hans";
  theme: string;
  prompt: string;
  summary: string | null;
  templates: AutomationFlow[];
  onClose: () => void;
  onStepChange: (step: 1 | 2 | 3) => void;
  onModeChange: (mode: "template" | "manual" | "hans") => void;
  onThemeChange: (theme: string) => void;
  onPromptChange: (value: string) => void;
  onChooseTemplate: (templateId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17131F]/45 p-4">
      <div className="w-full max-w-4xl rounded-[32px] border border-white/70 bg-white p-6 shadow-[0_24px_80px_rgba(33,20,50,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A96A1]">Nouvelle automatisation</div>
            <h2 className="mt-2 text-[24px] font-extrabold text-[#17131F]">Création guidée</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-[10px] border border-[#EBE6DF] px-3 py-2 text-sm font-semibold text-[#17131F]">Fermer</button>
        </div>

        <div className="mt-5 flex gap-2">
          {[1, 2, 3].map((index) => <div key={index} className={`h-2 flex-1 rounded-full ${step >= index ? "bg-[#6E4DE0]" : "bg-[#EEEAF3]"}`} />)}
        </div>

        {step === 1 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { id: "template", title: "Choisir un template", icon: "document", text: "Commencer par un modèle prêt à l’emploi." },
              { id: "manual", title: "Créer de zéro", icon: "chart", text: "Ouvrir un grand canvas vide." },
              { id: "hans", title: "Demander à Hans", icon: "sparkle", text: "Décrire le besoin en langage naturel." }
            ].map((item) => (
              <button key={item.id} type="button" onClick={() => { onModeChange(item.id as typeof mode); onStepChange(2); }} className="rounded-[24px] border border-[#EBE6DF] bg-[#FCFBF9] p-5 text-left transition hover:border-[#6E4DE0] hover:bg-[#FBF8FF]">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#F1ECFB] text-[#6E4DE0]"><Icon name={item.icon as "document" | "chart" | "sparkle"} className="h-5 w-5" /></div>
                <div className="mt-4 text-[17px] font-extrabold text-[#17131F]">{item.title}</div>
                <div className="mt-2 text-[13px] leading-6 text-[#6E6A76]">{item.text}</div>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6">
            <div className="text-[16px] font-extrabold text-[#17131F]">Que voulez-vous automatiser ?</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Réseaux sociaux", "Emails", "Avis", "SMS", "Clients", "Autre"].map((item) => (
                <button key={item} type="button" onClick={() => { onThemeChange(item); onStepChange(3); }} className={`rounded-full px-4 py-2.5 text-sm font-semibold ${theme === item ? "bg-[#2B1A4A] text-white" : "bg-[#F6F3EF] text-[#17131F]"}`}>{item}</button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-4">
            <div className="text-[16px] font-extrabold text-[#17131F]">Étape finale</div>
            {mode === "template" ? (
              <div className="grid gap-4 md:grid-cols-2">
                {templates.slice(0, 4).map((template) => (
                  <button key={template.id} type="button" onClick={() => onChooseTemplate(template.id)} className="rounded-[22px] border border-[#EBE6DF] bg-[#FCFBF9] p-5 text-left hover:border-[#6E4DE0] hover:bg-[#FBF8FF]">
                    <div className="text-[16px] font-extrabold text-[#17131F]">{template.title}</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#6E6A76]">{template.summary}</div>
                  </button>
                ))}
              </div>
            ) : mode === "hans" ? (
              <HansFlowGenerator
                prompt={prompt}
                summary={summary}
                onPromptChange={onPromptChange}
                onGenerate={onCreate}
                onActivate={onCreate}
                onRegenerate={onCreate}
                onCancel={onClose}
              />
            ) : (
              <div className="rounded-[22px] bg-[#F9F7F4] p-5">
                <div className="text-[14px] font-semibold text-[#17131F]">Un canvas vide sera généré pour la catégorie {theme.toLowerCase()}.</div>
                <button type="button" onClick={onCreate} className="mt-4 rounded-[10px] bg-[#2B1A4A] px-4 py-2.5 text-sm font-semibold text-white">
                  Créer le flow
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function hasCrowdedLayout(flow: AutomationFlow) {
  const horizontalGap = 56;
  const verticalGap = 48;
  const estimatedHeight = 270;

  return flow.nodes.some((node, index) => flow.nodes.slice(index + 1).some((other) => {
    const nodeWidth = node.width ?? 300;
    const otherWidth = other.width ?? 300;
    const separatedHorizontally = node.x + nodeWidth + horizontalGap <= other.x
      || other.x + otherWidth + horizontalGap <= node.x;
    const separatedVertically = node.y + estimatedHeight + verticalGap <= other.y
      || other.y + estimatedHeight + verticalGap <= node.y;
    return !separatedHorizontally && !separatedVertically;
  }));
}
