import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Scenario, RunRecord, ReplayResult, Provider } from './models';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Get headers with API key if available
   */
  private getHeaders(): HttpHeaders {
    const apiKey = this.authService.currentApiKey;
    const headers: { [key: string]: string } = {};
    if (apiKey) {
      headers['X-SPECTYRA-API-KEY'] = apiKey;
    }
    return new HttpHeaders(headers);
  }

  getProviders(): Observable<Provider[]> {
    return this.http.get<Provider[]>(`${this.baseUrl}/providers`);
  }

  getScenarios(): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.baseUrl}/scenarios`);
  }

  getScenario(id: string): Observable<Scenario> {
    return this.http.get<Scenario>(`${this.baseUrl}/scenarios/${id}`);
  }

  replay(scenarioId: string, provider: string, model: string, optimizationLevel: number = 2, proofMode: "live" | "estimator" = "live"): Observable<ReplayResult> {
    return this.http.post<ReplayResult>(
      `${this.baseUrl}/replay`,
      {
        scenario_id: scenarioId,
        provider,
        model,
        optimization_level: optimizationLevel,
        proof_mode: proofMode,
      },
      { headers: this.getHeaders() }
    );
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
    return this.http.get<any>(`${this.baseUrl}/savings/summary?${queryParams}`, {
      headers: this.getHeaders(),
    });
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
    return this.http.get<any[]>(`${this.baseUrl}/savings/timeseries?${queryParams}`, {
      headers: this.getHeaders(),
    });
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
    return this.http.get<any[]>(`${this.baseUrl}/savings/by-level?${queryParams}`, {
      headers: this.getHeaders(),
    });
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
    return this.http.get<any[]>(`${this.baseUrl}/savings/by-path?${queryParams}`, {
      headers: this.getHeaders(),
    });
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
    return this.http.get<any[]>(`${this.baseUrl}/savings/level-usage-timeseries?${queryParams}`, {
      headers: this.getHeaders(),
    });
  }

  proofEstimate(params: {
    path: 'talk' | 'code';
    provider: string;
    model: string;
    optimization_level: number;
    messages: any[];
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/proof/estimate`, params, {
      headers: this.getHeaders(),
    });
  }

  replaySimulate(params: {
    scenario_id: string;
    provider: string;
    model: string;
    optimization_level?: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/replay/simulate`, params, {
      headers: this.getHeaders(),
    });
  }

  getIntegrationSnippets(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/integrations/snippets`);
  }

  /**
   * Get billing status
   */
  getBillingStatus(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/billing/status`, {
      headers: this.getHeaders(),
    });
  }

  /**
   * Create Stripe checkout session
   */
  createCheckout(successUrl?: string, cancelUrl?: string): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/billing/checkout`,
      { success_url: successUrl, cancel_url: cancelUrl },
      { headers: this.getHeaders() }
    );
  }
}
