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
} from "./events/sdkEvents.js";
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
  ClaudeAgentOptions,
  AgentDecision,
  AgentOptionsRequest,
  AgentOptionsResponse,
  AgentEventRequest,
  AgentEventResponse,
} from "./types.js";

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
