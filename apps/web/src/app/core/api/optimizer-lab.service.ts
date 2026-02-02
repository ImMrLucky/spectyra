/**
 * Optimizer Lab Service
 * 
 * API client for the Optimizer Lab endpoint.
 * Runs the optimization pipeline in demo/QA mode.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Types
export type DemoType = 'chat' | 'code';
export type OptimizationLevel = 'safe' | 'balanced' | 'aggressive';
export type ViewMode = 'DEMO_VIEW' | 'ADMIN_DEBUG' | 'FORENSICS';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

/** Per-layer profit gate step (PG-SCC). */
export interface OptimizationStep {
  label: string;
  useAfter: boolean;
  before: number;
  after: number;
  pct: number;
  absChange?: number;
}

export interface DiffSummary {
  inputTokensBefore: number;
  inputTokensAfter: number;
  pctSaved: number;
  refsUsed?: number;
  phrasebookEntries?: number;
  codemapSnippetsKept?: number;
  codemapOmittedBlocks?: number;
  /** Per-layer before/after (SCC, RefPack, PhraseBook, CodeMap, Policy). */
  optimizationSteps?: OptimizationStep[];
}

export interface SafetySummary {
  preserved: string[];
  changed: string[];
  riskNotes: string[];
}

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
    refpack?: any;
    phrasebook?: any;
    codemap?: any;
  };
}

export interface OptimizeLabRequest {
  demoType: DemoType;
  path?: 'talk' | 'code';
  messages?: ChatMessage[];
  prompt?: string;
  repoContext?: string;
  optimizationLevel?: OptimizationLevel;
  options?: {
    codemapDetailLevel?: number;
    keepLastTurns?: number;
    maxRefs?: number;
  };
  debug?: boolean;
  requestedViewMode?: ViewMode;
}

export interface OptimizeLabResponse {
  viewMode: ViewMode;
  original: {
    messages: ChatMessage[];
    renderedText: string;
    tokenEstimate: TokenEstimate;
  };
  optimized: {
    messages: ChatMessage[] | { redacted: true; type: string; summary: string };
    renderedText: string | { redacted: true; type: string; summary: string };
    tokenEstimate: TokenEstimate;
  };
  diff: {
    appliedTransforms: string[];
    summary: DiffSummary;
    safetySummary: SafetySummary;
    unifiedDiff?: string;
  };
  meta: {
    demoType: DemoType;
    path: 'talk' | 'code';
    optimizationLevel: OptimizationLevel;
    latencyMs: number;
    timestamp: string;
  };
  debug?: DebugPayload;
}

@Injectable({ providedIn: 'root' })
export class OptimizerLabService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Run the optimization pipeline in optimize-only mode
   */
  runOptimization(request: OptimizeLabRequest): Observable<OptimizeLabResponse> {
    return this.http.post<OptimizeLabResponse>(
      `${this.apiUrl}/admin/optimize`,
      request
    );
  }

  /**
   * Check health of the optimizer lab endpoint
   */
  checkHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>(
      `${this.apiUrl}/admin/optimize/health`
    );
  }
}
