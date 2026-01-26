import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import type { Scenario, RunRecord, ReplayResult, Provider } from './models';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../../services/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private supabase: SupabaseService
  ) {}

  /**
   * Get headers for dashboard calls (uses Supabase JWT)
   */
  private async getDashboardHeaders(): Promise<HttpHeaders> {
    const token = await this.supabase.getAccessToken();
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return new HttpHeaders(headers);
  }

  /**
   * Get headers for gateway calls (uses API key)
   */
  private getGatewayHeaders(): HttpHeaders {
    const apiKey = this.authService.currentApiKey;
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['X-SPECTYRA-API-KEY'] = apiKey;
    }
    return new HttpHeaders(headers);
  }

  /**
   * Helper to make dashboard API calls (with JWT)
   */
  private dashboardCall<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: any): Observable<T> {
    return from(this.getDashboardHeaders()).pipe(
      switchMap(headers => {
        const options = { headers };
        if (method === 'GET' || method === 'DELETE') {
          return this.http.request<T>(method, url, options);
        } else {
          return this.http.request<T>(method, url, { ...options, body });
        }
      })
    );
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

  // Dashboard calls (use Supabase JWT)
  getRuns(limit: number = 50): Observable<RunRecord[]> {
    return this.dashboardCall<RunRecord[]>('GET', `${this.baseUrl}/runs?limit=${limit}`);
  }

  getRun(id: string): Observable<RunRecord> {
    return this.dashboardCall<RunRecord>('GET', `${this.baseUrl}/runs/${id}`);
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
    return this.dashboardCall<any>('GET', `${this.baseUrl}/savings/summary?${queryParams}`);
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
    return this.dashboardCall<any[]>('GET', `${this.baseUrl}/savings/timeseries?${queryParams}`);
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
    return this.dashboardCall<any[]>('GET', `${this.baseUrl}/savings/by-level?${queryParams}`);
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
    return this.dashboardCall<any[]>('GET', `${this.baseUrl}/savings/by-path?${queryParams}`);
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
    return this.dashboardCall<any[]>('GET', `${this.baseUrl}/savings/level-usage-timeseries?${queryParams}`);
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
    return this.http.get<any>(`${this.baseUrl}/integrations/snippets`, {
      headers: this.getHeaders(),
    });
  }

  /**
   * Get billing status (dashboard call - uses JWT)
   */
  getBillingStatus(): Observable<any> {
    return this.dashboardCall<any>('GET', `${this.baseUrl}/billing/status`);
  }

  /**
   * Create Stripe checkout session (dashboard call - uses JWT)
   */
  createCheckout(successUrl?: string, cancelUrl?: string): Observable<any> {
    return this.dashboardCall<any>('POST', `${this.baseUrl}/billing/checkout`, {
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }
}
