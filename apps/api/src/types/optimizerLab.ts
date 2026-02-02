/**
 * Optimizer Lab Types
 * 
 * Types for the admin optimize-only endpoint used for demos and QA testing.
 * Runs the full optimization pipeline without making provider calls.
 */

import type { ChatMessage } from "@spectyra/shared";

// Demo types supported by the Optimizer Lab
export type DemoType = "chat" | "code";

// Optimization levels
export type OptimizationLevel = "safe" | "balanced" | "aggressive";

// View modes for IP protection
export type ViewMode = "DEMO_VIEW" | "ADMIN_DEBUG" | "FORENSICS";

/**
 * Request to the /v1/admin/optimize endpoint
 */
export interface OptimizeLabRequest {
  // Required: type of demo (determines pipeline path)
  demoType: DemoType;
  
  // Optional: derive from demoType if omitted
  path?: "talk" | "code";
  
  // Preferred input format: array of messages
  messages?: ChatMessage[];
  
  // Quick input: auto-wrapped into messages if messages omitted
  prompt?: string;
  
  // Code demos only: appended as separate message block
  repoContext?: string;
  
  // Optimization level (maps to 0-4 internally)
  optimizationLevel?: OptimizationLevel;
  
  // Advanced options
  options?: {
    codemapDetailLevel?: number;
    keepLastTurns?: number;
    maxRefs?: number;
  };
  
  // Returns debug payload only if allowed by role
  debug?: boolean;
  
  // Requested view mode (server will enforce based on role)
  requestedViewMode?: ViewMode;
}

/**
 * Token estimate for before/after comparison
 */
export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

/**
 * Diff summary showing what was optimized
 */
export interface DiffSummary {
  inputTokensBefore: number;
  inputTokensAfter: number;
  pctSaved: number;
  refsUsed?: number;
  phrasebookEntries?: number;
  codemapSnippetsKept?: number;
  codemapOmittedBlocks?: number;
}

/**
 * Safety summary for customer comfort
 * Shows what was preserved vs changed to build trust
 */
export interface SafetySummary {
  // What was preserved (important content kept intact)
  preserved: string[];
  
  // What was changed (how optimization was applied)
  changed: string[];
  
  // Risk notes for transparency
  riskNotes: string[];
}

/**
 * Debug information (only for ADMIN_DEBUG or FORENSICS mode)
 */
export interface DebugPayload {
  budgets?: {
    keepLastTurns: number;
    maxRefpackEntries: number;
    compressionAggressiveness: number;
    phrasebookAggressiveness: number;
    codemapDetailLevel: number;
  };
  spectral?: {
    nNodes: number;
    nEdges: number;
    stabilityIndex: number;
    lambda2?: number;
    contradictionEnergy?: number;
    recommendation: string;
    stableCount: number;
    unstableCount: number;
  };
  runDebug?: any;
  transforms?: {
    refpack?: {
      tokensBefore: number;
      tokensAfter: number;
      entriesCount: number;
      replacementsMade: number;
    };
    phrasebook?: {
      tokensBefore: number;
      tokensAfter: number;
      entriesCount: number;
      applied: boolean;
    };
    codemap?: {
      tokensBefore: number;
      tokensAfter: number;
      symbolsCount: number;
      applied: boolean;
    };
  };
}

/**
 * Redacted content placeholder for DEMO_VIEW mode
 */
export interface RedactedContent {
  redacted: true;
  type: "REFPACK" | "PHRASEBOOK" | "CODEMAP";
  summary: string; // e.g., "REFPACK { 5 entries redacted }"
}

/**
 * Response from the /v1/admin/optimize endpoint
 */
export interface OptimizeLabResponse {
  // The effective view mode (may differ from requested based on role)
  viewMode: ViewMode;
  
  // Original input
  original: {
    messages: ChatMessage[];
    renderedText: string;
    tokenEstimate: TokenEstimate;
  };
  
  // Optimized output (may be redacted in DEMO_VIEW mode)
  optimized: {
    messages: ChatMessage[] | RedactedContent;
    renderedText: string | RedactedContent;
    tokenEstimate: TokenEstimate;
  };
  
  // Diff and summary
  diff: {
    appliedTransforms: string[];
    summary: DiffSummary;
    safetySummary: SafetySummary;
    // Only in ADMIN_DEBUG or FORENSICS mode
    unifiedDiff?: string;
  };
  
  // Metadata
  meta: {
    demoType: DemoType;
    path: "talk" | "code";
    optimizationLevel: OptimizationLevel;
    latencyMs: number;
    timestamp: string;
  };
  
  // Debug info (only if allowed and requested)
  debug?: DebugPayload;
}

/**
 * Error response
 */
export interface OptimizeLabError {
  error: string;
  message?: string;
  details?: any;
}

/**
 * Map optimization level strings to numeric values (0-4)
 */
export function optimizationLevelToNumber(level: OptimizationLevel): number {
  switch (level) {
    case "safe":
      return 1;
    case "balanced":
      return 2;
    case "aggressive":
      return 4;
    default:
      return 2;
  }
}

/**
 * Map demo type to path
 */
export function demoTypeToPath(demoType: DemoType): "talk" | "code" {
  return demoType === "code" ? "code" : "talk";
}
