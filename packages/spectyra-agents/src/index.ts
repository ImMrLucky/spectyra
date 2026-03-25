/**
 * @spectyra/agents
 *
 * Agent wrappers for Spectyra optimization.
 * Local-first, direct-provider. Works without Spectyra cloud.
 *
 * Supports off / observe / on modes via the `runMode` parameter.
 */

// Types
export type {
  RepoContext,
  OptimizationReportPublic,
  AgentOptimizationResult,
  ClaudeLikeMessage,
  OpenAILikeMessage,
  GenericMessage,
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  SavingsReport,
  PromptComparison,
} from "./types";

// Claude wrapper
export {
  wrapClaudeRequest,
  type WrapClaudeRequestInput,
  type WrapClaudeRequestOutput,
  type ClaudeWrapperConfig,
} from "./claude";

// OpenAI wrapper
export {
  wrapOpenAIInput,
  type WrapOpenAIInputInput,
  type WrapOpenAIInputOutput,
  type OpenAIWrapperConfig,
} from "./openai";

// Generic wrapper
export {
  wrapGenericAgentLoop,
  type WrapGenericAgentLoopConfig,
  type GenericWrapperConfig,
} from "./generic";

// Repo context helpers
export {
  captureRepoContext,
  type CaptureRepoContextOptions,
} from "./repoContext";
