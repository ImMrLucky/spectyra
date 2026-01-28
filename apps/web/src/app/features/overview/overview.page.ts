import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface IntegrationStatus {
  sdk_local: boolean;
  sdk_remote: boolean;
  api: boolean;
  last_event_at: string | null;
  last_run_at: string | null;
}

interface Usage24h {
  calls: number;
  tokens: number;
  cost_estimate_usd: number;
}

interface TopModel {
  model: string;
  count: number;
}

interface TopPolicy {
  policy_id: string;
  name: string;
  trigger_count: number;
}

interface RecentRun {
  id: string;
  type: 'agent' | 'chat';
  source: 'sdk-local' | 'sdk-remote' | 'api';
  model: string;
  status: string;
  created_at: string;
}

import type { OptimizationSavings } from '@spectyra/shared';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.scss'],
})
export class OverviewPage implements OnInit {
  loading = true;
  error: string | null = null;
  
  integrationStatus: IntegrationStatus | null = null;
  usage24h: Usage24h | null = null;
  topModels: TopModel[] = [];
  topPolicies: TopPolicy[] = [];
  recentRuns: RecentRun[] = [];
  optimizationSavings: OptimizationSavings[] = [];
  
  hasIntegrations = false;
  hasRuns = false;

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading = true;
    this.error = null;

    try {
      // Load integration status
      try {
        const status = await firstValueFrom(this.http.get<IntegrationStatus>(`${environment.apiUrl}/integrations/status`));
        this.integrationStatus = status || {
          sdk_local: false,
          sdk_remote: false,
          api: false,
          last_event_at: null,
          last_run_at: null,
        };
        this.hasIntegrations = this.integrationStatus.sdk_local || this.integrationStatus.sdk_remote || this.integrationStatus.api;
      } catch (err: any) {
        // Endpoint might not exist yet - use defaults
        this.integrationStatus = {
          sdk_local: false,
          sdk_remote: false,
          api: false,
          last_event_at: null,
          last_run_at: null,
        };
      }

      // Load 24h usage
      try {
        const usage = await firstValueFrom(this.http.get<Usage24h>(`${environment.apiUrl}/usage?range=24h`));
        this.usage24h = usage || { calls: 0, tokens: 0, cost_estimate_usd: 0 };
      } catch (err: any) {
        this.usage24h = { calls: 0, tokens: 0, cost_estimate_usd: 0 };
      }

      // Load top models
      try {
        const models = await firstValueFrom(this.http.get<TopModel[]>(`${environment.apiUrl}/usage/top-models?range=24h`));
        this.topModels = models || [];
      } catch (err: any) {
        this.topModels = [];
      }

      // Load top policies
      try {
        const policies = await firstValueFrom(this.http.get<TopPolicy[]>(`${environment.apiUrl}/policies/top-triggered?range=24h`));
        this.topPolicies = policies || [];
      } catch (err: any) {
        this.topPolicies = [];
      }

      // Load recent runs
      try {
        const runs = await firstValueFrom(this.http.get<RecentRun[]>(`${environment.apiUrl}/runs?limit=5`));
        this.recentRuns = runs || [];
        this.hasRuns = this.recentRuns.length > 0;
      } catch (err: any) {
        this.recentRuns = [];
      }

      // Load optimization savings (Core Moat v1)
      try {
        const optimizations = await firstValueFrom(this.http.get<OptimizationSavings[]>(`${environment.apiUrl}/usage/optimizations?range=24h`));
        this.optimizationSavings = optimizations || [];
      } catch (err: any) {
        this.optimizationSavings = [];
      }
    } catch (err: any) {
      this.error = 'Failed to load dashboard data';
      console.error('Overview load error:', err);
    } finally {
      this.loading = false;
    }
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
  }
}
