import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiClientService } from '../../core/api/api-client.service';
import { firstValueFrom } from 'rxjs';

export interface ProjectSdkSummaryResponse {
  total_calls: number;
  total_savings_usd: number;
  avg_savings_percent: number;
  environment_breakdown: Array<{ environment: string; calls: number; savings_usd: number }>;
  recent_runs: Array<{
    id: string;
    environment: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    optimized_input_tokens: number;
    estimated_savings_usd: string;
    created_at: string;
  }>;
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './project-detail.page.html',
  styleUrls: ['./project-detail.page.scss'],
})
export class ProjectDetailPage implements OnInit {
  projectId = '';
  loading = true;
  error: string | null = null;
  summary: ProjectSdkSummaryResponse | null = null;
  timeseries: Array<{
    date: string;
    total_calls: number;
    total_savings_usd: number;
    total_input_tokens: number;
    total_output_tokens: number;
  }> = [];

  constructor(
    private route: ActivatedRoute,
    private api: ApiClientService,
  ) {}

  async ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    await this.load();
  }

  async load() {
    this.loading = true;
    this.error = null;
    try {
      this.summary = await firstValueFrom(this.api.getProjectSdkSummary(this.projectId));
      this.timeseries = await firstValueFrom(this.api.getProjectSdkTimeseries(this.projectId, '30d'));
    } catch (e: unknown) {
      const err = e as { error?: { error?: string }; message?: string };
      this.error = err?.error?.error || err?.message || 'Failed to load project analytics';
    } finally {
      this.loading = false;
    }
  }
}
