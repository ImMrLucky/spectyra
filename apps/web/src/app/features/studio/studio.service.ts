import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

export interface StudioRunResult {
  runId: string;
  createdAt: string;
  raw: StudioRunSide;
  spectyra: StudioRunSide;
  metrics: StudioRunMetrics;
  appliedTransforms?: string[];
  meta?: {
    estimated: boolean;
    reverted?: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class StudioService {
  constructor(private http: HttpClient) {}

  runScenario(req: StudioRunRequest): Observable<StudioRunResult> {
    return this.http.post<StudioRunResult>(`${environment.apiUrl}/admin/studio/run`, req);
  }
}

