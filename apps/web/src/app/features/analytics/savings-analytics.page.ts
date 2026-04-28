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

export interface SdkTelemetryRollupRow {
  environment?: string;
  model?: string;
  calls: number;
  estimated_savings_usd: number;
  input_tokens_before: number;
  input_tokens_after: number;
  output_tokens: number;
  input_token_reduction_pct: number;
}

export interface SdkTelemetryOrgRollup {
  total_calls: number;
  total_estimated_savings_usd: number;
  total_input_tokens_before: number;
  total_input_tokens_after: number;
  total_output_tokens: number;
  overall_input_token_reduction_pct: number;
  avg_estimated_savings_usd_per_call: number;
  aggregate_message_turns: number;
  aggregate_repeated_context_tokens_avoided: number;
  aggregate_repeated_tool_output_tokens_avoided: number;
  aggregate_compressible_units_hint: number;
  aggregate_transform_count: number;
  runs_with_stuck_loop_signal: number;
  by_environment: SdkTelemetryRollupRow[];
  by_model: SdkTelemetryRollupRow[];
}

interface AnalyticsSummary {
  total_sessions: number;
  lifetime_savings_usd: number;
  total_input_tokens_before: number;
  total_input_tokens_after: number;
  avg_token_reduction_pct: number;
  /** Split by `integrationType` from each synced session (companion vs SDK session sync, etc.). */
  by_source: AnalyticsSourceBreakdown[];
  /** Aggregated from `POST /v1/telemetry/run` (in-app SDK with API key). */
  sdk_telemetry?: SdkTelemetryOrgRollup;
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  total_sessions: 0,
  lifetime_savings_usd: 0,
  total_input_tokens_before: 0,
  total_input_tokens_after: 0,
  avg_token_reduction_pct: 0,
  by_source: [],
  sdk_telemetry: {
    total_calls: 0,
    total_estimated_savings_usd: 0,
    total_input_tokens_before: 0,
    total_input_tokens_after: 0,
    total_output_tokens: 0,
    overall_input_token_reduction_pct: 0,
    avg_estimated_savings_usd_per_call: 0,
    aggregate_message_turns: 0,
    aggregate_repeated_context_tokens_avoided: 0,
    aggregate_repeated_tool_output_tokens_avoided: 0,
    aggregate_compressible_units_hint: 0,
    aggregate_transform_count: 0,
    runs_with_stuck_loop_signal: 0,
    by_environment: [],
    by_model: [],
  },
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
      this.summary = { ...raw, by_source: raw.by_source ?? [], sdk_telemetry: raw.sdk_telemetry ?? EMPTY_SUMMARY.sdk_telemetry };
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
