import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { StudioScenarioId } from './studio-scenarios.registry';

export interface StudioRunRequest {
  scenarioId: StudioScenarioId;
  inputs: {
    primary: string;
    secondary?: string;
    advanced?: Record<string, any>;
  };
  mode: 'raw_vs_spectyra';
  /** off | observe | on — maps to the universal mode model */
  runMode?: 'off' | 'observe' | 'on';
}

export interface StudioRunSide {
  promptText: string;
  modelOutputText?: string;
  toolCalls?: Array<{ tool: string; args: any; resultPreview?: string }>;
  toolSignals?: { run_terminal_cmd: number; read_file: number; apply_patch: number };
  tokens: { input: number; output: number; total: number };
  latencyMs: number;
  costUsd?: number;
  violations?: Array<{ code: string; message: string }>;
}

export interface StudioRunMetrics {
  tokenSavingsPct?: number;
  inputTokensSaved?: number;
  totalTokensSaved?: number;
  costSavingsPct?: number;
  retriesAvoided?: number;
  violationsPrevented?: number;
  toolCallsReduced?: number;
}

/** Spectral flow intelligence (same engine as local runs; computed from transcript text). */
export interface StudioFlowSummary {
  recommendation: 'REUSE' | 'EXPAND' | 'ASK_CLARIFY';
  stabilityIndex: number;
  lambda2: number;
  contradictionEnergy: number;
  nNodes?: number;
  nEdges?: number;
}

export interface StudioRunResult {
  runId: string;
  createdAt: string;
  raw: StudioRunSide;
  spectyra: StudioRunSide;
  metrics: StudioRunMetrics;
  appliedTransforms?: string[];
  /** Present when the API returns spectral analysis for the optimized path. */
  flowSummary?: StudioFlowSummary;
  meta?: {
    estimated: boolean;
    reverted?: boolean;
  };
  security?: {
    inferencePath: string;
    providerBillingOwner: string;
    telemetryMode: string;
    promptSnapshotMode: string;
    cloudRelay: string;
  };
}

@Injectable({ providedIn: 'root' })
export class StudioService {
  constructor(private http: HttpClient) {}

  runScenario(req: StudioRunRequest, byokProviderKey?: string): Observable<StudioRunResult> {
    const key = (byokProviderKey ?? '').trim();
    const headers = key ? new HttpHeaders({ 'X-PROVIDER-KEY': key }) : undefined;
    return this.http.post<StudioRunResult>(`${environment.apiUrl}/studio/run`, req, { headers });
  }
}
