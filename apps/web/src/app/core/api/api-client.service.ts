import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Scenario, RunRecord, ReplayResult, Provider } from './models';

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getProviders(): Observable<Provider[]> {
    return this.http.get<Provider[]>(`${this.baseUrl}/providers`);
  }

  getScenarios(): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.baseUrl}/scenarios`);
  }

  getScenario(id: string): Observable<Scenario> {
    return this.http.get<Scenario>(`${this.baseUrl}/scenarios/${id}`);
  }

  replay(scenarioId: string, provider: string, model: string, optimizationLevel: number = 2): Observable<ReplayResult> {
    return this.http.post<ReplayResult>(`${this.baseUrl}/replay`, {
      scenario_id: scenarioId,
      provider,
      model,
      optimization_level: optimizationLevel,
    });
  }

  getRuns(limit: number = 50): Observable<RunRecord[]> {
    return this.http.get<RunRecord[]>(`${this.baseUrl}/runs?limit=${limit}`);
  }

  getRun(id: string): Observable<RunRecord> {
    return this.http.get<RunRecord>(`${this.baseUrl}/runs/${id}`);
  }

  getSavingsSummary(params: {
    from?: string;
    to?: string;
    path?: 'talk' | 'code' | 'both';
    provider?: string;
    model?: string;
  }): Observable<any> {
    const queryParams = new URLSearchParams();
    if (params.from) queryParams.set('from', params.from);
    if (params.to) queryParams.set('to', params.to);
    if (params.path) queryParams.set('path', params.path);
    if (params.provider) queryParams.set('provider', params.provider);
    if (params.model) queryParams.set('model', params.model);
    return this.http.get<any>(`${this.baseUrl}/savings/summary?${queryParams}`);
  }

  getSavingsTimeseries(params: {
    from?: string;
    to?: string;
    path?: 'talk' | 'code' | 'both';
    provider?: string;
    model?: string;
    bucket?: 'day' | 'week';
  }): Observable<any[]> {
    const queryParams = new URLSearchParams();
    if (params.from) queryParams.set('from', params.from);
    if (params.to) queryParams.set('to', params.to);
    if (params.path) queryParams.set('path', params.path);
    if (params.provider) queryParams.set('provider', params.provider);
    if (params.model) queryParams.set('model', params.model);
    if (params.bucket) queryParams.set('bucket', params.bucket);
    return this.http.get<any[]>(`${this.baseUrl}/savings/timeseries?${queryParams}`);
  }

  getSavingsByLevel(params: {
    from?: string;
    to?: string;
    path?: 'talk' | 'code' | 'both';
    provider?: string;
    model?: string;
  }): Observable<any[]> {
    const queryParams = new URLSearchParams();
    if (params.from) queryParams.set('from', params.from);
    if (params.to) queryParams.set('to', params.to);
    if (params.path) queryParams.set('path', params.path);
    if (params.provider) queryParams.set('provider', params.provider);
    if (params.model) queryParams.set('model', params.model);
    return this.http.get<any[]>(`${this.baseUrl}/savings/by-level?${queryParams}`);
  }

  getSavingsByPath(params: {
    from?: string;
    to?: string;
    path?: 'talk' | 'code' | 'both';
    provider?: string;
    model?: string;
  }): Observable<any[]> {
    const queryParams = new URLSearchParams();
    if (params.from) queryParams.set('from', params.from);
    if (params.to) queryParams.set('to', params.to);
    if (params.path) queryParams.set('path', params.path);
    if (params.provider) queryParams.set('provider', params.provider);
    if (params.model) queryParams.set('model', params.model);
    return this.http.get<any[]>(`${this.baseUrl}/savings/by-path?${queryParams}`);
  }

  getLevelUsageTimeseries(params: {
    from?: string;
    to?: string;
    path?: 'talk' | 'code' | 'both';
    provider?: string;
    model?: string;
    bucket?: 'day' | 'week';
  }): Observable<any[]> {
    const queryParams = new URLSearchParams();
    if (params.from) queryParams.set('from', params.from);
    if (params.to) queryParams.set('to', params.to);
    if (params.path) queryParams.set('path', params.path);
    if (params.provider) queryParams.set('provider', params.provider);
    if (params.model) queryParams.set('model', params.model);
    if (params.bucket) queryParams.set('bucket', params.bucket);
    return this.http.get<any[]>(`${this.baseUrl}/savings/level-usage-timeseries?${queryParams}`);
  }

  proofEstimate(params: {
    path: 'talk' | 'code';
    provider: string;
    model: string;
    optimization_level: number;
    messages: any[];
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/proof/estimate`, params);
  }

  replaySimulate(params: {
    scenario_id: string;
    provider: string;
    model: string;
    optimization_level?: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/replay/simulate`, params);
  }
}
