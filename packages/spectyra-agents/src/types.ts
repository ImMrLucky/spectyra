/**
 * Types for Spectyra Agent Wrappers
 */

/**
 * RepoContext for CodeMap optimization
 */
export type RepoContext = {
  rootPath?: string;          // For local VM use
  files?: Array<{ path: string; content: string }>; // For hosted usage
  changedFiles?: string[];    // Helps focus CodeMap
  entrypoints?: string[];     // e.g. ["apps/api/src/index.ts"]
  languageHint?: string;      // ts/python/etc
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
  meta?: any; // Framework-specific metadata
}
