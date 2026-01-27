/**
 * @spectyra/agents
 * 
 * Coding agent wrappers for Spectyra Core Moat v1 optimizations.
 * 
 * Provides drop-in optimizers for Claude SDK, OpenAI, and generic agent frameworks.
 */

// Types
export type {
  RepoContext,
  OptimizationReportPublic,
  ClaudeLikeMessage,
  OpenAILikeMessage,
  GenericMessage,
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
