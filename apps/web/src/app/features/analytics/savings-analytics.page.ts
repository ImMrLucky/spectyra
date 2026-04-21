import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AnalyticsSourceBreakdown {
  integration_type: string;
  product_label: string;
  total_sessions: number;
  lifetime_savings_usd: number;
  total_input_tokens_before: number;
  total_input_tokens_after: number;
  avg_token_reduction_pct: number;
}

interface AnalyticsSummary {
  total_sessions: number;
  lifetime_savings_usd: number;
  total_input_tokens_before: number;
  total_input_tokens_after: number;
  avg_token_reduction_pct: number;
  /** Split by `integrationType` from each synced session (companion vs SDK session sync, etc.). */
  by_source: AnalyticsSourceBreakdown[];
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  total_sessions: 0,
  lifetime_savings_usd: 0,
  total_input_tokens_before: 0,
  total_input_tokens_after: 0,
  avg_token_reduction_pct: 0,
  by_source: [],
};

@Component({
  selector: 'app-savings-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './savings-analytics.page.html',
  styleUrls: ['./savings-analytics.page.scss'],
})
export class SavingsAnalyticsPage implements OnInit {
  loading = false;
  /** Friendly copy when the API fails or cloud data is not ready — never raw SQL errors */
  cloudNotice: string | null = null;
  summary: AnalyticsSummary | null = null;

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    this.loading = true;
    this.cloudNotice = null;
    try {
      const raw = await firstValueFrom(
        this.http.get<AnalyticsSummary>(`${environment.apiUrl}/analytics/summary`),
      );
      this.summary = { ...raw, by_source: raw.by_source ?? [] };
    } catch (e: any) {
      const status = e?.status as number | undefined;
      this.summary = { ...EMPTY_SUMMARY };
      if (status === 401 || status === 403) {
        this.cloudNotice =
          'Sign in to see cloud-synced savings. Local analytics on your device are unchanged.';
      } else {
        this.cloudNotice =
          'Cloud session summaries are not available yet, or nothing has been synced. ' +
          'Sync only runs when a client turns it on (e.g. Local Companion “sync to cloud”, or the desktop app). ' +
          'Per-call SDK metered usage is separate — see Projects → open a project.';
      }
    } finally {
      this.loading = false;
    }
  }
}
