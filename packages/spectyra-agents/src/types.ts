/**
 * Types for Spectyra Agent Wrappers
 */

import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  SavingsReport,
  PromptComparison,
} from "@spectyra/core-types";

// Re-export core-types for convenience
export type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  SavingsReport,
  PromptComparison,
};

/**
 * RepoContext for CodeMap optimization
 */
export type RepoContext = {
  rootPath?: string;
  files?: Array<{ path: string; content: string }>;
  changedFiles?: string[];
  entrypoints?: string[];
  languageHint?: string;
};

/**
 * Public optimization report (customer-safe)
 */
export interface OptimizationReportPublic {
  layers: {
    refpack: boolean;
    phrasebook: boolean;
    codemap: boolean;
    semantic_cache: boolean;
    cache_hit: boolean;
  };
  tokens: {
    estimated: boolean;
    input_before?: number;
    input_after?: number;
    saved?: number;
    pct_saved?: number;
  };
  spectral?: {
    nNodes: number;
    nEdges: number;
    stabilityIndex: number;
    lambda2: number;
  };
}

/**
 * Extended result that includes both legacy report and new shared report.
 */
export interface AgentOptimizationResult {
  optimizationReport: OptimizationReportPublic;
  savingsReport?: SavingsReport;
  promptComparison?: PromptComparison;
}

/**
 * Claude-like message format
 */
export type ClaudeLikeMessage =
  | { role: "system"; content: string }
  | { role: "user" | "assistant"; content: string }
  | { role: "tool"; tool_name: string; content: string };

/**
 * OpenAI-like message format
 */
export type OpenAILikeMessage =
  | { role: "system"; content: string }
  | { role: "user" | "assistant"; content: string }
  | { role: "tool"; name: string; content: string };

/**
 * Generic message format (framework-agnostic)
 */
export interface GenericMessage {
  role: string;
  content: string;
  meta?: any;
}
