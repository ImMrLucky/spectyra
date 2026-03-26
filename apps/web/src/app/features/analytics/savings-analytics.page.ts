import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface AnalyticsSummary {
  total_sessions: number;
  lifetime_savings_usd: number;
  total_input_tokens_before: number;
  total_input_tokens_after: number;
  avg_token_reduction_pct: number;
}

@Component({
  selector: 'app-savings-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './savings-analytics.page.html',
  styleUrls: ['./savings-analytics.page.scss'],
})
export class SavingsAnalyticsPage implements OnInit {
  loading = false;
  error: string | null = null;
  summary: AnalyticsSummary | null = null;

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    this.loading = true;
    this.error = null;
    try {
      this.summary = await firstValueFrom(
        this.http.get<AnalyticsSummary>(`${environment.apiUrl}/analytics/summary`),
      );
    } catch (e: any) {
      this.error = e?.error?.error || e?.message || 'Could not load cloud analytics.';
      this.summary = null;
    } finally {
      this.loading = false;
    }
  }
}
