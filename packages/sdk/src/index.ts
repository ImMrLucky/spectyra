/**
 * Spectyra SDK
 *
 * Local-first LLM optimization. Your provider call, your key, your data.
 *
 * @example
 * ```ts
 * import { createSpectyra, createOpenAIAdapter } from '@spectyra/sdk';
 *
 * const spectyra = createSpectyra({
 *   runMode: "on",
 *   licenseKey: process.env.SPECTYRA_LICENSE_KEY,
 * });
 *
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 * const { providerResult, report } = await spectyra.complete(
 *   { provider: "openai", client: openai, model: "gpt-4.1-mini", messages },
 *   createOpenAIAdapter(),
 * );
 *
 * console.log(`Saved ${report.estimatedSavingsPct.toFixed(1)}%`);
 * ```
 */

// Primary API
export { createSpectyra } from "./createSpectyra.js";
export type { SpectyraInstance } from "./createSpectyra.js";
export { normalizeSpectyraRunMode } from "@spectyra/core-types";

// Production telemetry (safe diagnostics for cloud rollups)
export { buildSpectyraProductionDiagnostics } from "./cloud/buildProductionDiagnostics.js";
export { flushMonitorEventsToCloud } from "./cloud/monitorSync.js";
export type { FlushMonitorEventsToCloudOptions } from "./cloud/monitorSync.js";
export { resolveEffectiveTelemetryMode } from "./observability/resolveEffectiveTelemetryMode.js";
export type { SpectyraProductionDiagnostics } from "./cloud/buildProductionDiagnostics.js";

// Workflow sessions (multi-step analytics)
export { startSpectyraSession } from "./session/startSpectyraSession.js";
export type { SpectyraSessionHandle, StartSpectyraSessionOptions } from "./session/startSpectyraSession.js";

// Normalized local events (same model as Local Companion; subscribe via sdkEventEngine)
export {
  sdkEventEngine,
  shouldEmitSdkNormalizedEvents,
  ingestSdkSessionStart,
  ingestSdkSessionEnd,
  ingestSdkComplete,
  ingestSdkPromptComparisonAvailable,
  emitSdkEventsForStandaloneComplete,
} from "./events/emitters.js";
export type { SpectyraEvent, SpectyraEventType } from "@spectyra/event-core";

// Learning (Phase 5) — optional profile on `SpectyraConfig`
export { createEmptyProfile, applyUpdate } from "@spectyra/learning";
export type { LearningProfile, GlobalLearningSnapshot } from "@spectyra/canonical-model";

// Moat Phase 3–4 summaries from the SDK event buffer (parity with Local Companion HTTP summaries)
export {
  moatPhase34SummariesFromEvents,
  moatPhase34SummariesFromSdkBuffer,
} from "./analytics/sdkMoatSummaries.js";
export type { SdkMoatPhase34Payload } from "./analytics/sdkMoatSummaries.js";
export type { ExecutionGraphSummaryPayload } from "@spectyra/execution-graph";
export type { StateDeltaAnalyticsSummary } from "@spectyra/state-delta";

// Workflow policy (Phase 6) — parity with Local Companion / Desktop companion
export {
  evaluateWorkflowPolicyFromEvents,
  type WorkflowPolicyMode,
} from "./workflow/sdkWorkflowPolicyFromEvents.js";
export { workflowPolicySummaryFromSdkBuffer } from "./workflow/workflowPolicyFromSdkBuffer.js";
export { WorkflowPolicyBlockedError } from "./workflow/WorkflowPolicyBlockedError.js";
export type {
  WorkflowPolicyResult,
  WorkflowPolicyViolation,
  WorkflowPolicyConfig,
} from "@spectyra/workflow-policy";

// OpenClaw-style model aliases (`spectyra/smart`, `spectyra/fast`) — same as companion
export {
  resolveSpectyraModel,
  defaultAliasModels,
  spectyraOpenClawModelDefinitions,
} from "@spectyra/shared";
export type { ResolveSpectyraModelInput } from "@spectyra/shared";

// Provider adapters (direct-provider, no Spectyra cloud)
export { createOpenAIAdapter } from "./adapters/openai.js";
export { createAnthropicAdapter } from "./adapters/anthropic.js";
export { createGroqAdapter } from "./adapters/groq.js";

// Shared platform types (re-exported from @spectyra/core-types)
export type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  InferencePath,
  ProviderBillingOwner,
  IntegrationType,
  SavingsReport,
  PromptComparison,
  SecurityLabels,
} from "./types.js";

// Analytics (workflow sessions, cloud-safe payloads)
export type {
  AnalyticsEvent,
  SessionAnalyticsRecord,
  StepAnalyticsRecord,
  SyncedAnalyticsPayload,
} from "@spectyra/analytics-core";

// SDK-specific types
export type {
  SpectyraConfig,
  SpectyraCompleteInput,
  SpectyraCompleteResult,
  ProviderAdapter,
  SpectyraCtx,
  PromptMeta,
  SpectyraLogLevel,
  SpectyraDevtoolsConfig,
  SpectyraEntitlementsConfig,
  SpectyraEnvironment,
  SpectyraSavingsEvent,
  SpectyraRequestStartEvent,
  SpectyraRequestEndEvent,
  SpectyraOptimizationEvent,
  SpectyraSavingsCalculation,
  SpectyraCostCalculatedPayload,
  ClaudeAgentOptions,
  AgentDecision,
  AgentOptionsRequest,
  AgentOptionsResponse,
  AgentEventRequest,
  AgentEventResponse,
  SpectyraMonitorSdkConfig,
  SpectyraMonitorJsonlConfig,
  SpectyraMonitorConsoleConfig,
  SpectyraFeaturesConfig,
  SpectyraAnalyticsSdkConfig,
  SpectyraLocalDevServerConfig,
} from "./types.js";

// Monitor core (metadata-only local buffer + JSONL; see docs/SPECTYRA_AI_MONITOR_SPEC.md)
export { createMonitorEngine } from "./monitor/monitorEngine.js";
export type { MonitorEngine, MonitorEngineOptions } from "./monitor/monitorEngine.js";
export { detectProviderFromHost, normalizeMonitorProvider } from "./monitor/providerDetection.js";
export { extractOpenAiStyleUsage, extractUsageFromProviderResult } from "./monitor/usageExtraction.js";
export { buildMonitorEventFromComplete, buildFailureMonitorEvent } from "./monitor/emitFromComplete.js";
export { buildWasteSignalsFromCompletePath, buildWasteSignalsFromHttpAutoPath } from "./monitor/wasteHeuristics.js";
export type { WasteContextFromComplete, WasteContextFromHttpAuto } from "./monitor/wasteHeuristics.js";
export { buildMonitorSummaryFromEvents, emptyMonitorSummary } from "./monitor/summaries.js";
export type {
  SpectyraMonitorEvent,
  SpectyraMonitorSummary,
  SpectyraMonitorProvider,
  SpectyraWasteSignal,
  SpectyraMonitorIntegrationMode,
  SpectyraMonitorPricingSource,
  SpectyraMonitorOptimizerStatus,
} from "./monitor/monitorTypes.js";
export {
  createSpectyraDevBridgePlaceholder,
  isSpectyraDevBridgeEnabled,
  handleSpectyraDevBridgeRequest,
  createSpectyraDevBridgeConnectMiddleware,
  registerSpectyraDevBridgeFastify,
  normalizeDevBridgeRoutePrefix,
  resolveSpectyraDevBridgePublicOrigin,
} from "./monitor/localDevServer.js";
export type { SpectyraDevBridgeMonitorEngine } from "./monitor/localDevServer.js";
export { resolveMonitorEnabledInApp } from "./monitor/resolveMonitorEnabled.js";
export { createMonitorCloudSyncDebouncer, shouldSyncMonitorToCloud } from "./cloud/monitorCloudSyncDebouncer.js";
export type { SpectyraMonitorBreakdownRow } from "./monitor/monitorAggregates.js";
// Optional framework hooks (Vercel AI SDK, LangChain.js, LlamaIndex.TS)
export type { SpectyraFrameworkMonitorRecord } from "./monitor/hooks/types.js";
export { createSpectyraVercelAiOnFinish, createSpectyraVercelAiTelemetryMetadata } from "./monitor/hooks/vercelAi.js";
export type { SpectyraVercelAiHookContext } from "./monitor/hooks/vercelAi.js";
export { createSpectyraLangChainMonitorCallbacks } from "./monitor/hooks/langchain.js";
export type { SpectyraLangChainHookContext } from "./monitor/hooks/langchain.js";
export { createSpectyraLlamaIndexMonitorSubscriber } from "./monitor/hooks/llamaindex.js";
export type { SpectyraLlamaIndexHookContext } from "./monitor/hooks/llamaindex.js";
export type {
  SpectyraRunInput,
  SpectyraRunResult,
  SpectyraRunExecutor,
  SpectyraRunExecuteContext,
} from "./run/spectyraRun.js";
export { createExecutorAdapter, mapCompleteToRunResult } from "./run/spectyraRun.js";
export type {
  SpectyraEntitlementStatus,
  SpectyraLastRun,
  SpectyraMetricsSnapshot,
  SpectyraSavingsSummary,
  SpectyraSessionCostSummary,
  SpectyraQuotaStatus,
  SpectyraQuotaState,
  SpectyraDashboardPlan,
} from "./observability/observabilityTypes.js";
export {
  isSpectyraProductionEnvironment,
  resolveEffectiveOverlay,
  resolveEffectiveDebug,
  resolveSpectyraEnvironmentLabel,
} from "./config/sdkUiEnv.js";
export {
  shouldMountDevtoolsByDefault,
  mountSpectyraDevtools,
} from "./devtools/mountDevtools.js";
export type { SpectyraDevtoolsMountHandle } from "./devtools/mountDevtools.js";
export { mapToSpectyraEntitlementStatus } from "./entitlements/mapEntitlementStatus.js";
export type { EntitlementsStatusPayload } from "./entitlements/mapEntitlementStatus.js";
export { EntitlementHttpError, fetchEntitlementStatus } from "./entitlements/fetchEntitlementStatus.js";

// Pricing & savings (runtime snapshot from Spectyra API; not bundled permanently in apps)
export type {
  CurrencyCode,
  PricingUnit,
  ProviderName,
  EndpointClass,
  PricingComponent,
  ModelPricingEntry,
  ProviderPricingSnapshot,
  CostBreakdown,
  CostBreakdownLine,
  NormalizedUsage,
  SavingsCalculation,
} from "./pricing/types.js";
export { fetchPricingSnapshot } from "./pricing/pricingClient.js";
export {
  getPricingSnapshot,
  getPricingSnapshotMeta,
  startPricingRuntime,
} from "./pricing/pricingRuntime.js";
export type { PricingSnapshotMeta } from "./pricing/pricingRuntime.js";
export { calculateCostFromEntry, calculateSavingsFromUsages } from "./pricing/costCalculator.js";
export { normalizedUsageFromTokens } from "./pricing/normalizeUsage.js";
export { resolveModelPricingEntry } from "./pricing/modelResolver.js";
export { estimateCost, estimateTokens } from "./local/tokenEstimator.js";

export { createSpectyraLogger } from "./logging/logger.js";
export type { SpectyraLogger } from "./logging/logger.js";
export { getSavingsSummaryFromSession, getSessionCostSummaryFromSession } from "./metrics/savingsAggregator.js";

// Legacy API (deprecated but still supported)
export { SpectyraClient } from "./legacy/SpectyraClient.js";
export type {
  SpectyraClientConfig,
  ChatOptions,
  ChatResponse,
  ChatMessage,
  Usage,
  Path,
  Mode,
} from "./types.js";
